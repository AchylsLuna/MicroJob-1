import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "../../lib/storage";
import { API_URL } from "../../config";
import { apiRequest, asList } from "../../lib/api";
import EmployerNavigation from "../../components/employerNavigation";
import ScrollView from "../../components/ui/SmoothScrollView";
import TabTopNav from "../../components/TabTopNav";
import ConfirmModal from "../../components/ConfirmModal";
import PublicProfile from "../shared/PublicProfile";
import { tokens } from "../../theme/tokens";
import {
  normalizeApplicationStatus,
  type ApplicationStatus,
} from "../../lib/status";
import { useToast } from "../../contexts/ToastContext";

type JobItem = {
  _id: string;
  title: string;
  location?: string;
  jobType?: string;
  addressType?: string;
  status?: string;
  positionsNeeded?: number;
  hiredCount?: number;
  category?: { _id?: string; name?: string } | string;
  salary?: number;
  createdAt?: string;
};
type Offer = {
  id: string;
  amount: number;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "hired";
  createdAt?: string;
  acceptedAt?: string;
} | null;
type ApplicationItem = {
  _id: string;
  status: ApplicationStatus;
  createdAt?: string;
  job: JobItem;
  applicant: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
    rating?: { averageRating?: number; totalReviews?: number };
  };
  match?: { percentage?: number };
  nextInterview?: {
    _id?: string;
    scheduledAt: string;
    location?: string | null;
    mode?: string;
    notes?: string | null;
  } | null;
  agreedAmount?: number;
  workStatus?: string;
  paymentStatus?: string;
  offer?: Offer;
};
type Stage = "New" | "Shortlisted" | "Interview" | "Offer" | "Hired" | "Closed";
type ConfirmAction = {
  title: string;
  question: string;
  detail: string;
  label: string;
  destructive?: boolean;
  run: () => Promise<void>;
};

const STAGES: Stage[] = [
  "New",
  "Shortlisted",
  "Interview",
  "Offer",
  "Hired",
  "Closed",
];
const stageFor = (status: ApplicationStatus): Stage =>
  status === "Applied"
    ? "New"
    : status === "Shortlisted"
      ? "Shortlisted"
      : ["Interview Scheduled", "Interviewed"].includes(status)
        ? "Interview"
        : status === "Offer Sent"
          ? "Offer"
          : status === "Hired"
            ? "Hired"
            : "Closed";
const initials = (item: ApplicationItem) =>
  `${item.applicant.firstName?.[0] || ""}${item.applicant.lastName?.[0] || ""}`.toUpperCase() ||
  "U";
const nameOf = (item: ApplicationItem) =>
  `${item.applicant.firstName || ""} ${item.applicant.lastName || ""}`.trim() ||
  "Worker";
const php = (value?: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value || 0),
  );

export default function EmployerApplications({
  activeTab = "Applications",
  onTabPress,
  onMessageWorker,
}: {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onMessageWorker?: (payload: {
    workerId: string;
    workerName?: string;
    jobId: string;
  }) => void;
}) {
  const toast = useToast();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("New");
  const [search, setSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatus, setJobStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [minMatch, setMinMatch] = useState(0);
  const [dateOrder, setDateOrder] = useState<"newest" | "oldest">("newest");
  const [filterVisible, setFilterVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offerAmounts, setOfferAmounts] = useState<Record<string, string>>({});
  const [changeReasons, setChangeReasons] = useState<Record<string, string>>(
    {},
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [profileId, setProfileId] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ApplicationItem | null>(
    null,
  );
  const [interviewAt, setInterviewAt] = useState<Date>(
    new Date(Date.now() + 86_400_000),
  );
  const [interviewMode, setInterviewMode] = useState("virtual");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [datePicker, setDatePicker] = useState(false);
  const [timePicker, setTimePicker] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [jobsResult, applicationsResult] = await Promise.all([
        apiRequest(
          `${API_URL}/jobs/mine`,
          { headers },
          "Failed to load job openings.",
        ),
        apiRequest(
          `${API_URL}/applications/employer?includeHidden=true`,
          { headers },
          "Failed to load candidates.",
        ),
      ]);
      if (!jobsResult.ok || !applicationsResult.ok)
        throw new Error(
          jobsResult.message ||
            applicationsResult.message ||
            "Unable to load applications.",
        );
      setJobs(
        asList<JobItem>(jobsResult.raw, ["jobs"]).sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        ),
      );
      setApplications(
        asList<any>(applicationsResult.raw, ["applications"]).map((item) => ({
          ...item,
          status: normalizeApplicationStatus(item.status),
        })),
      );
    } catch (caught: any) {
      setError(caught?.message || "Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!selectedJobId) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setSelectedJobId(null);
        setExpandedId(null);
        setSearch("");
        return true;
      },
    );
    return () => subscription.remove();
  }, [selectedJobId]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .map((job) =>
              typeof job.category === "object"
                ? job.category?.name
                : job.category,
            )
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [jobs],
  );
  const applicationsForJob = useCallback(
    (jobId: string) =>
      applications.filter((item) => String(item.job?._id) === String(jobId)),
    [applications],
  );
  const jobRows = useMemo(
    () =>
      jobs.filter((job) => {
        const query = jobSearch.trim().toLowerCase();
        const jobCategory =
          typeof job.category === "object" ? job.category?.name : job.category;
        return (
          (!query ||
            `${job.title} ${job.location || ""}`
              .toLowerCase()
              .includes(query)) &&
          (jobStatus === "All" || job.status === jobStatus) &&
          (category === "All" || jobCategory === category)
        );
      }),
    [category, jobSearch, jobStatus, jobs],
  );
  const selectedJob = jobs.find((job) => job._id === selectedJobId) || null;
  const stageCounts = useMemo(
    () =>
      Object.fromEntries(
        STAGES.map((value) => [
          value,
          selectedJobId
            ? applicationsForJob(selectedJobId).filter(
                (item) => stageFor(item.status) === value,
              ).length
            : 0,
        ]),
      ) as Record<Stage, number>,
    [applicationsForJob, selectedJobId],
  );
  const visibleCandidates = useMemo(() => {
    if (!selectedJobId) return [];
    const query = search.trim().toLowerCase();
    return applicationsForJob(selectedJobId)
      .filter(
        (item) =>
          stageFor(item.status) === stage &&
          (!query ||
            `${nameOf(item)} ${item.applicant.email || ""}`
              .toLowerCase()
              .includes(query)) &&
          Number(item.match?.percentage || 0) >= minMatch,
      )
      .sort(
        (a, b) =>
          (new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()) *
          (dateOrder === "newest" ? 1 : -1),
      );
  }, [applicationsForJob, dateOrder, minMatch, search, selectedJobId, stage]);

  const request = async (
    applicationId: string,
    path: string,
    body?: Record<string, unknown>,
  ) => {
    setBusyId(applicationId);
    setError("");
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const result = await apiRequest(
        `${API_URL}/${path}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
        "Unable to complete this action.",
      );
      if (!result.ok) throw new Error(result.message);
      await load(true);
      return true;
    } catch (caught: any) {
      toast.error(caught?.message || "Unable to complete this action.");
      return false;
    } finally {
      setBusyId(null);
    }
  };
  const changeStatus = async (item: ApplicationItem, status: string) => {
    setBusyId(item._id);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const result = await apiRequest(
        `${API_URL}/applications/${item._id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status }),
        },
        "Unable to update candidate.",
      );
      if (!result.ok) throw new Error(result.message);
      await load(true);
      toast.success(`Candidate moved to ${status}.`);
    } catch (caught: any) {
      toast.error(caught?.message || "Unable to update candidate.");
    } finally {
      setBusyId(null);
    }
  };
  const openInterview = (item: ApplicationItem) => {
    setScheduleTarget(item);
    const next = item.nextInterview
      ? new Date(item.nextInterview.scheduledAt)
      : new Date(Date.now() + 86_400_000);
    setInterviewAt(
      Number.isNaN(next.getTime()) ? new Date(Date.now() + 86_400_000) : next,
    );
    setInterviewMode(item.nextInterview?.mode || "virtual");
    setInterviewLocation(item.nextInterview?.location || "");
    setInterviewNotes(item.nextInterview?.notes || "");
  };
  const saveInterview = async () => {
    if (!scheduleTarget || busyId) return;
    const interviewId = scheduleTarget.nextInterview?._id;
    setBusyId(scheduleTarget._id);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const result = await apiRequest(
        `${API_URL}/applications/${scheduleTarget._id}/interviews${interviewId ? `/${interviewId}` : ""}`,
        {
          method: interviewId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            scheduledAt: interviewAt.toISOString(),
            mode: interviewMode,
            location: interviewLocation.trim(),
            notes: interviewNotes.trim(),
          }),
        },
        "Unable to schedule interview.",
      );
      if (!result.ok) throw new Error(result.message);
      setScheduleTarget(null);
      await load(true);
      toast.success("Interview schedule saved.");
    } catch (caught: any) {
      toast.error(caught?.message || "Unable to schedule interview.");
    } finally {
      setBusyId(null);
    }
  };
  const executeConfirm = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    await action.run();
  };

  if (profileId)
    return (
      <PublicProfile
        userId={profileId}
        viewAs="worker"
        onBack={() => setProfileId(null)}
      />
    );

  return (
    <View style={styles.container}>
      <TabTopNav title={selectedJob ? "Candidates" : "Applications"} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={tokens.colors.brand}
          />
        }
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {selectedJob ? (
          <>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => {
                setSelectedJobId(null);
                setExpandedId(null);
                setSearch("");
              }}
              accessibilityRole="button"
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={tokens.colors.brand}
              />
              <Text style={styles.backText}>All job openings</Text>
            </TouchableOpacity>
            <View style={styles.selectedJobCard}>
              <Text style={styles.eyebrow}>SELECTED JOB</Text>
              <Text style={styles.selectedTitle}>{selectedJob.title}</Text>
              <View style={styles.metaLine}>
                <Ionicons
                  name="location-outline"
                  size={15}
                  color={tokens.colors.textMuted}
                />
                <Text style={styles.metaText}>
                  {selectedJob.location || "Location not set"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Summary
                  value={applicationsForJob(selectedJob._id).length}
                  label="Candidates"
                />
                <Summary
                  value={selectedJob.hiredCount || 0}
                  label={`Hired of ${selectedJob.positionsNeeded || 1}`}
                />
                <Summary
                  value={
                    applicationsForJob(selectedJob._id).filter((item) =>
                      ["Interview Scheduled", "Interviewed"].includes(
                        item.status,
                      ),
                    ).length
                  }
                  label="Interviewed"
                />
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stageTabs}
            >
              {STAGES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.stageTab,
                    stage === value && styles.stageTabActive,
                  ]}
                  onPress={() => {
                    setStage(value);
                    setExpandedId(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: stage === value }}
                >
                  <Text
                    style={[
                      styles.stageText,
                      stage === value && styles.stageTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                  <View
                    style={[
                      styles.countBadge,
                      stage === value && styles.countBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        stage === value && styles.countTextActive,
                      ]}
                    >
                      {stageCounts[value]}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <SearchBar
              value={search}
              onChange={setSearch}
              onFilter={() => setFilterVisible(true)}
              placeholder="Search candidates"
              activeFilter={minMatch > 0 || dateOrder !== "newest"}
            />
            {error ? (
              <ErrorCard message={error} onRetry={() => void load()} />
            ) : null}
            {loading ? (
              <Skeleton />
            ) : visibleCandidates.length === 0 ? (
              <Empty
                icon="people-outline"
                title={`No ${stage.toLowerCase()} candidates`}
                body="Candidates in this stage will appear here."
              />
            ) : (
              visibleCandidates.map((item) => (
                <CandidateCard
                  key={item._id}
                  item={item}
                  expanded={expandedId === item._id}
                  busy={busyId === item._id}
                  offerValue={offerAmounts[item._id] || ""}
                  changeReason={changeReasons[item._id] || ""}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === item._id ? null : item._id,
                    )
                  }
                  onOfferChange={(value: string) =>
                    setOfferAmounts((current) => ({
                      ...current,
                      [item._id]: value.replace(/[^0-9.]/g, ""),
                    }))
                  }
                  onReasonChange={(value: string) =>
                    setChangeReasons((current) => ({
                      ...current,
                      [item._id]: value,
                    }))
                  }
                  onProfile={() => setProfileId(item.applicant._id)}
                  onMessage={() =>
                    onMessageWorker?.({
                      workerId: item.applicant._id,
                      workerName: nameOf(item),
                      jobId: item.job._id,
                    })
                  }
                  onInterview={() => openInterview(item)}
                  onShortlist={() => void changeStatus(item, "Shortlisted")}
                  onReject={() =>
                    setConfirmAction({
                      title: "Reject candidate?",
                      question: `Reject ${nameOf(item)}?`,
                      detail:
                        "The worker will be notified. This action can be reviewed in the closed stage.",
                      label: "Reject Candidate",
                      destructive: true,
                      run: () => changeStatus(item, "Rejected"),
                    })
                  }
                  onRemove={() =>
                    setConfirmAction({
                      title: "Remove application?",
                      question: `Remove ${nameOf(item)} from this list?`,
                      detail:
                        "This removes the application from your employer view.",
                      label: "Remove",
                      destructive: true,
                      run: async () => {
                        setBusyId(item._id);
                        const token = await AsyncStorage.getItem("auth_token");
                        const result = await apiRequest(
                          `${API_URL}/applications/${item._id}/employer`,
                          {
                            method: "DELETE",
                            headers: token
                              ? { Authorization: `Bearer ${token}` }
                              : undefined,
                          },
                          "Unable to remove application.",
                        );
                        setBusyId(null);
                        if (!result.ok) toast.error(result.message);
                        else await load(true);
                      },
                    })
                  }
                  onOffer={() => {
                    const amount = Number(offerAmounts[item._id]);
                    setConfirmAction({
                      title: "Send formal offer?",
                      question: `Offer ${nameOf(item)} ${php(amount)}?`,
                      detail: `Advertised minimum: ${php(item.job.salary)}. Additional escrow: ${php(Math.max(0, amount - Number(item.job.salary || 0)))}.`,
                      label: "Send Offer",
                      run: async () => {
                        if (
                          await request(
                            item._id,
                            `applications/${item._id}/offers`,
                            { amount },
                          )
                        )
                          toast.success("Formal offer sent in chat.");
                      },
                    });
                  }}
                  onCancelOffer={() =>
                    setConfirmAction({
                      title: "Cancel offer?",
                      question: `Cancel the ${php(item.offer?.amount)} offer?`,
                      detail:
                        "Any additional negotiated escrow will be returned safely.",
                      label: "Cancel Offer",
                      destructive: true,
                      run: async () => {
                        if (item.offer)
                          await request(
                            item._id,
                            `job-offers/${item.offer.id}/cancel`,
                          );
                      },
                    })
                  }
                  onConfirmHire={() =>
                    setConfirmAction({
                      title: "Confirm hiring?",
                      question: `Hire ${nameOf(item)} for ${php(item.offer?.amount)}?`,
                      detail:
                        "This starts the worker assignment using the accepted escrow-backed terms.",
                      label: "Confirm Hire",
                      run: async () => {
                        if (
                          item.offer &&
                          (await request(
                            item._id,
                            `job-offers/${item.offer.id}/confirm-hire`,
                          ))
                        )
                          toast.success("Worker hired successfully.");
                      },
                    })
                  }
                  onAuthorize={() =>
                    void request(
                      item._id,
                      `applications/${item._id}/payment/authorize`,
                    )
                  }
                  onPay={() =>
                    setConfirmAction({
                      title: "Approve and pay?",
                      question: `Release ${php(item.agreedAmount || item.job.salary)} to ${nameOf(item)}?`,
                      detail:
                        "This approves submitted work and releases only this worker’s secured payment. It cannot be paid twice.",
                      label: "Approve and Pay",
                      run: async () => {
                        if (
                          await request(
                            item._id,
                            `applications/${item._id}/payment/settle`,
                          )
                        )
                          toast.success("Worker paid successfully.");
                      },
                    })
                  }
                  onRequestChanges={() =>
                    void request(
                      item._id,
                      `applications/${item._id}/work/request-changes`,
                      { reason: changeReasons[item._id] },
                    )
                  }
                />
              ))
            )}
          </>
        ) : (
          <>
            <SearchBar
              value={jobSearch}
              onChange={setJobSearch}
              onFilter={() => setFilterVisible(true)}
              placeholder="Search job openings"
              activeFilter={jobStatus !== "All" || category !== "All"}
            />
            <View style={styles.listHeading}>
              <View>
                <Text style={styles.heading}>Job Openings</Text>
                <Text style={styles.headingSub}>
                  {jobRows.length} of {jobs.length} jobs
                </Text>
              </View>
            </View>
            {error ? (
              <ErrorCard message={error} onRetry={() => void load()} />
            ) : null}
            {loading ? (
              <Skeleton />
            ) : jobRows.length === 0 ? (
              <Empty
                icon="briefcase-outline"
                title="No job openings found"
                body="Change the filters or create a new employer job post."
              />
            ) : (
              jobRows.map((job) => {
                const candidates = applicationsForJob(job._id);
                const interviewed = candidates.filter((item) =>
                  ["Interview Scheduled", "Interviewed"].includes(item.status),
                ).length;
                return (
                  <TouchableOpacity
                    key={job._id}
                    style={styles.jobCard}
                    onPress={() => {
                      setSelectedJobId(job._id);
                      setStage("New");
                      setExpandedId(null);
                    }}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={`Open candidates for ${job.title}`}
                  >
                    <View style={styles.jobAccent} />
                    <View style={styles.jobTop}>
                      <View style={styles.jobIcon}>
                        <Ionicons
                          name="briefcase-outline"
                          size={20}
                          color={tokens.colors.brand}
                        />
                      </View>
                      <View style={styles.jobCopy}>
                        <Text style={styles.jobTitle} numberOfLines={2}>
                          {job.title}
                        </Text>
                        <Text style={styles.jobStatus}>
                          {job.status || "Available"}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={tokens.colors.brand}
                      />
                    </View>
                    <View style={styles.jobMeta}>
                      <Meta
                        icon="location-outline"
                        text={job.location || "Location not set"}
                      />
                      <Meta
                        icon="time-outline"
                        text={job.jobType || "Local work"}
                      />
                      <Meta
                        icon="people-outline"
                        text={`${job.hiredCount || 0}/${job.positionsNeeded || 1} hired`}
                      />
                    </View>
                    <View style={styles.jobStats}>
                      <Text style={styles.jobStat}>
                        <Text style={styles.jobStatValue}>
                          {candidates.length}
                        </Text>{" "}
                        candidates
                      </Text>
                      <View style={styles.dot} />
                      <Text style={styles.jobStat}>
                        <Text style={styles.jobStatValue}>{interviewed}</Text>{" "}
                        interviewed
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>
      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
      <ConfirmModal
        visible={Boolean(confirmAction)}
        title={confirmAction?.title || ""}
        description={[confirmAction?.question, confirmAction?.detail]
          .filter(Boolean)
          .join("\n\n")}
        confirmLabel={confirmAction?.label || "Confirm"}
        destructive={confirmAction?.destructive}
        pending={Boolean(busyId)}
        onCancel={() => {
          if (!busyId) setConfirmAction(null);
        }}
        onConfirm={() => void executeConfirm()}
      />
      <Filters
        visible={filterVisible}
        candidateMode={Boolean(selectedJob)}
        jobStatus={jobStatus}
        category={category}
        categories={categories}
        minMatch={minMatch}
        dateOrder={dateOrder}
        stage={stage}
        onClose={() => setFilterVisible(false)}
        onJobStatus={setJobStatus}
        onCategory={setCategory}
        onMatch={setMinMatch}
        onDateOrder={setDateOrder}
        onStage={(value: Stage) => {
          setStage(value);
          setExpandedId(null);
        }}
      />
      <InterviewModal
        item={scheduleTarget}
        value={interviewAt}
        mode={interviewMode}
        location={interviewLocation}
        notes={interviewNotes}
        busy={Boolean(busyId)}
        onClose={() => setScheduleTarget(null)}
        onDate={() => setDatePicker(true)}
        onTime={() => setTimePicker(true)}
        onMode={setInterviewMode}
        onLocation={setInterviewLocation}
        onNotes={setInterviewNotes}
        onSave={() => void saveInterview()}
      />
      {datePicker ? (
        <DateTimePicker
          value={interviewAt}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, value) => {
            setDatePicker(false);
            if (value)
              setInterviewAt(
                (current) =>
                  new Date(
                    value.getFullYear(),
                    value.getMonth(),
                    value.getDate(),
                    current.getHours(),
                    current.getMinutes(),
                  ),
              );
          }}
        />
      ) : null}
      {timePicker ? (
        <DateTimePicker
          value={interviewAt}
          mode="time"
          onChange={(_, value) => {
            setTimePicker(false);
            if (value)
              setInterviewAt(
                (current) =>
                  new Date(
                    current.getFullYear(),
                    current.getMonth(),
                    current.getDate(),
                    value.getHours(),
                    value.getMinutes(),
                  ),
              );
          }}
        />
      ) : null}
    </View>
  );
}

function CandidateCard(props: any) {
  const { item, expanded, busy } = props;
  const offer = item.offer as Offer;
  const offerActive = offer && ["pending", "accepted"].includes(offer.status);
  const offerAmount = Number(props.offerValue);
  const offerValid =
    Number.isFinite(offerAmount) && offerAmount >= Number(item.job.salary || 0);
  return (
    <View style={[styles.candidateCard, expanded && styles.candidateExpanded]}>
      <TouchableOpacity
        style={styles.candidateTap}
        onPress={props.onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.avatar}>
          {item.applicant.avatarUrl ? (
            <Image
              source={{ uri: item.applicant.avatarUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>{initials(item)}</Text>
          )}
        </View>
        <View style={styles.candidateCopy}>
          <Text style={styles.candidateName}>{nameOf(item)}</Text>
          <Text style={styles.appliedDate}>
            Applied{" "}
            {item.createdAt
              ? new Date(item.createdAt).toLocaleDateString("en-PH")
              : "recently"}
          </Text>
          <View style={styles.candidatePills}>
            <Pill
              text={`${Number(item.match?.percentage || 0)}% match`}
              tone="blue"
            />
            <Pill
              text={`${Number(item.applicant.rating?.averageRating || 0).toFixed(1)} ★`}
              tone="gold"
            />
            <Pill text={item.status} tone="neutral" />
            {item.nextInterview ? (
              <Pill
                text={`Next ${new Date(item.nextInterview.scheduledAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`}
                tone="blue"
              />
            ) : null}
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={tokens.colors.brand}
        />
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.expandedBody}>
          <View style={styles.actionGrid}>
            <Action
              icon="person-outline"
              label="View Profile"
              onPress={props.onProfile}
            />
            <Action
              icon="chatbubble-outline"
              label="Message"
              onPress={props.onMessage}
            />
            {!["Hired", "Rejected", "Withdrawn"].includes(item.status) ? (
              <Action
                icon="calendar-outline"
                label={item.nextInterview ? "Reschedule" : "Interview"}
                onPress={props.onInterview}
              />
            ) : null}
            {item.status === "Applied" ? (
              <Action
                icon="bookmark-outline"
                label="Shortlist"
                onPress={props.onShortlist}
              />
            ) : null}
          </View>
          {item.nextInterview ? (
            <View style={styles.infoPanel}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={tokens.colors.brand}
              />
              <View style={styles.flex}>
                <Text style={styles.infoTitle}>Interview scheduled</Text>
                <Text style={styles.infoText}>
                  {new Date(item.nextInterview.scheduledAt).toLocaleString(
                    "en-PH",
                  )}{" "}
                  · {item.nextInterview.mode || "other"}
                </Text>
              </View>
            </View>
          ) : null}
          {!["Hired", "Rejected", "Withdrawn"].includes(item.status) &&
          !offerActive ? (
            <View style={styles.offerPanel}>
              <Text style={styles.panelTitle}>Formal escrow-backed offer</Text>
              <Text style={styles.panelHelp}>
                Guaranteed minimum {php(item.job.salary)}
              </Text>
              <View style={styles.inputAction}>
                <TextInput
                  style={styles.compactInput}
                  value={props.offerValue}
                  onChangeText={props.onOfferChange}
                  keyboardType="decimal-pad"
                  placeholder="PHP amount"
                  placeholderTextColor={tokens.colors.textSubtle}
                />
                <TouchableOpacity
                  style={[
                    styles.primarySmall,
                    (!offerValid || busy) && styles.disabled,
                  ]}
                  disabled={!offerValid || busy}
                  onPress={props.onOffer}
                >
                  <Text style={styles.primarySmallText}>Review Offer</Text>
                </TouchableOpacity>
              </View>
              {offerAmount > Number(item.job.salary || 0) ? (
                <Text style={styles.escrowText}>
                  Additional escrow:{" "}
                  {php(offerAmount - Number(item.job.salary || 0))}
                </Text>
              ) : null}
            </View>
          ) : null}
          {offerActive ? (
            <View style={styles.offerPanel}>
              <Text style={styles.panelTitle}>
                {offer?.status === "accepted"
                  ? "Offer accepted"
                  : "Awaiting worker"}
              </Text>
              <Text style={styles.panelHelp}>
                {php(offer?.amount)} escrow-backed offer
              </Text>
              <View style={styles.twoActions}>
                {offer?.status === "accepted" ? (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    disabled={busy}
                    onPress={props.onConfirmHire}
                  >
                    <Text style={styles.primaryButtonText}>Confirm Hire</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.dangerOutline}
                  disabled={busy}
                  onPress={props.onCancelOffer}
                >
                  <Text style={styles.dangerText}>Cancel Offer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {item.status === "Hired" ? (
            <View style={styles.offerPanel}>
              <Text style={styles.panelTitle}>Assignment and payment</Text>
              <Text style={styles.panelHelp}>
                {php(item.agreedAmount || item.job.salary)} · Work:{" "}
                {item.workStatus || "In Progress"} · Payment:{" "}
                {item.paymentStatus || "Secured"}
              </Text>
              {!["Authorized", "Paid"].includes(
                item.paymentStatus || "Secured",
              ) ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  disabled={busy}
                  onPress={props.onAuthorize}
                >
                  <Text style={styles.secondaryButtonText}>
                    Authorize Payment · Held Until Approval
                  </Text>
                </TouchableOpacity>
              ) : null}
              {item.workStatus === "Submitted" &&
              item.paymentStatus !== "Paid" ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  disabled={busy}
                  onPress={props.onPay}
                >
                  <Text style={styles.primaryButtonText}>Approve and Pay</Text>
                </TouchableOpacity>
              ) : null}
              {item.workStatus === "Submitted" &&
              item.paymentStatus !== "Paid" ? (
                <View style={styles.inputAction}>
                  <TextInput
                    style={styles.compactInput}
                    value={props.changeReason}
                    onChangeText={props.onReasonChange}
                    placeholder="Required change reason"
                    placeholderTextColor={tokens.colors.textSubtle}
                  />
                  <TouchableOpacity
                    style={[
                      styles.secondarySmall,
                      !props.changeReason.trim() && styles.disabled,
                    ]}
                    disabled={!props.changeReason.trim() || busy}
                    onPress={props.onRequestChanges}
                  >
                    <Text style={styles.secondarySmallText}>
                      Request Changes
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}
          {!["Hired", "Rejected", "Withdrawn"].includes(item.status) ? (
            <TouchableOpacity
              style={styles.rejectButton}
              disabled={busy}
              onPress={props.onReject}
            >
              <Ionicons
                name="close-circle-outline"
                size={17}
                color={tokens.colors.danger}
              />
              <Text style={styles.rejectText}>Reject Candidate</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.removeButton}
            disabled={busy}
            onPress={props.onRemove}
          >
            <Text style={styles.removeText}>Remove from employer list</Text>
          </TouchableOpacity>
          {busy ? (
            <ActivityIndicator
              style={styles.busy}
              color={tokens.colors.brand}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const Summary = ({ value, label }: { value: number; label: string }) => (
  <View style={styles.summary}>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);
const Meta = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.metaItem}>
    <Ionicons name={icon} size={15} color={tokens.colors.brand} />
    <Text style={styles.metaItemText} numberOfLines={1}>
      {text}
    </Text>
  </View>
);
const Pill = ({ text, tone }: { text: string; tone: string }) => (
  <View
    style={[
      styles.pill,
      tone === "blue" && styles.pillBlue,
      tone === "gold" && styles.pillGold,
    ]}
  >
    <Text style={styles.pillText}>{text}</Text>
  </View>
);
const Action = ({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.action} onPress={onPress}>
    <Ionicons name={icon} size={18} color={tokens.colors.brand} />
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
);
const SearchBar = ({
  value,
  onChange,
  onFilter,
  placeholder,
  activeFilter,
}: any) => (
  <View style={styles.searchRow}>
    <View style={styles.searchBox}>
      <Ionicons
        name="search-outline"
        size={19}
        color={tokens.colors.textMuted}
      />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textSubtle}
      />
    </View>
    <TouchableOpacity
      style={[styles.filterButton, activeFilter && styles.filterButtonActive]}
      onPress={onFilter}
      accessibilityLabel="Open filters"
    >
      <Ionicons
        name="options-outline"
        size={20}
        color={activeFilter ? tokens.colors.white : tokens.colors.brand}
      />
    </TouchableOpacity>
  </View>
);
const ErrorCard = ({ message, onRetry }: any) => (
  <View style={styles.errorCard}>
    <Ionicons
      name="cloud-offline-outline"
      size={20}
      color={tokens.colors.danger}
    />
    <Text style={styles.errorText}>{message}</Text>
    <TouchableOpacity onPress={onRetry} style={styles.retry}>
      <Text style={styles.retryText}>Retry</Text>
    </TouchableOpacity>
  </View>
);
const Empty = ({ icon, title, body }: any) => (
  <View style={styles.empty}>
    <Ionicons name={icon} size={34} color={tokens.colors.textSubtle} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
  </View>
);
const Skeleton = () => (
  <View style={styles.skeleton}>
    {[0, 1, 2].map((item) => (
      <View key={item} style={styles.skeletonCard} />
    ))}
  </View>
);

function Filters({
  visible,
  candidateMode,
  jobStatus,
  category,
  categories,
  minMatch,
  dateOrder,
  stage,
  onClose,
  onJobStatus,
  onCategory,
  onMatch,
  onDateOrder,
  onStage,
}: any) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.filterSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {candidateMode ? "Candidate filters" : "Job filters"}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons
                name="close"
                size={21}
                color={tokens.colors.brandDark}
              />
            </TouchableOpacity>
          </View>
          {candidateMode ? (
            <>
              <Text style={styles.fieldLabel}>Minimum match</Text>
              <View style={styles.choiceRow}>
                {[0, 50, 75].map((value) => (
                  <Choice
                    key={value}
                    label={value ? `${value}%+` : "Any"}
                    active={minMatch === value}
                    onPress={() => onMatch(value)}
                  />
                ))}
              </View>
              <Text style={styles.fieldLabel}>Application date</Text>
              <View style={styles.choiceRow}>
                <Choice
                  label="Newest"
                  active={dateOrder === "newest"}
                  onPress={() => onDateOrder("newest")}
                />
                <Choice
                  label="Oldest"
                  active={dateOrder === "oldest"}
                  onPress={() => onDateOrder("oldest")}
                />
              </View>
              <Text style={styles.fieldLabel}>Stage</Text>
              <View style={styles.choiceRow}>
                {STAGES.map((value) => (
                  <Choice
                    key={value}
                    label={value}
                    active={stage === value}
                    onPress={() => onStage(value)}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Job status</Text>
              <View style={styles.choiceRow}>
                {[
                  "All",
                  "Available",
                  "In Progress",
                  "Closed",
                  "Completed",
                  "Cancelled",
                ].map((value) => (
                  <Choice
                    key={value}
                    label={value}
                    active={jobStatus === value}
                    onPress={() => onJobStatus(value)}
                  />
                ))}
              </View>
              {categories.length ? (
                <>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <View style={styles.choiceRow}>
                    {["All", ...categories].map((value: string) => (
                      <Choice
                        key={value}
                        label={value}
                        active={category === value}
                        onPress={() => onCategory(value)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
            <Text style={styles.primaryButtonText}>Show Results</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const Choice = ({ label, active, onPress }: any) => (
  <TouchableOpacity
    style={[styles.choice, active && styles.choiceActive]}
    onPress={onPress}
  >
    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);
function InterviewModal({
  item,
  value,
  mode,
  location,
  notes,
  busy,
  onClose,
  onDate,
  onTime,
  onMode,
  onLocation,
  onNotes,
  onSave,
}: any) {
  return (
    <Modal
      visible={Boolean(item)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.interviewSheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>INTERVIEW</Text>
              <Text style={styles.sheetTitle}>
                {item?.nextInterview
                  ? "Reschedule interview"
                  : "Schedule interview"}
              </Text>
              <Text style={styles.panelHelp}>{item ? nameOf(item) : ""}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons
                name="close"
                size={21}
                color={tokens.colors.brandDark}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.twoActions}>
            <TouchableOpacity style={styles.dateButton} onPress={onDate}>
              <Ionicons
                name="calendar-outline"
                size={17}
                color={tokens.colors.brand}
              />
              <Text style={styles.dateText}>
                {value.toLocaleDateString("en-PH")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateButton} onPress={onTime}>
              <Ionicons
                name="time-outline"
                size={17}
                color={tokens.colors.brand}
              />
              <Text style={styles.dateText}>
                {value.toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldLabel}>Mode</Text>
          <View style={styles.choiceRow}>
            {["virtual", "phone", "in-person", "other"].map((value) => (
              <Choice
                key={value}
                label={value}
                active={mode === value}
                onPress={() => onMode(value)}
              />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Location or meeting link</Text>
          <TextInput
            style={styles.sheetInput}
            value={location}
            onChangeText={onLocation}
            placeholder="Meeting link, office, or call details"
            placeholderTextColor={tokens.colors.textSubtle}
          />
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.sheetInput, styles.notes]}
            value={notes}
            onChangeText={onNotes}
            multiline
            placeholder="Preparation details"
            placeholderTextColor={tokens.colors.textSubtle}
          />
          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.disabled]}
            disabled={busy}
            onPress={onSave}
          >
            {busy ? (
              <ActivityIndicator color={tokens.colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Save Interview</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: {
    padding: tokens.layout.gutter,
    paddingBottom: tokens.layout.tabBarClearance,
    gap: 12,
  },
  flex: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: tokens.colors.brand,
  },
  searchRow: { flexDirection: "row", gap: 9 },
  searchBox: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    gap: 8,
  },
  searchInput: { flex: 1, color: tokens.colors.text, fontSize: 14 },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: { backgroundColor: tokens.colors.brand },
  listHeading: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heading: { fontSize: 20, fontWeight: "800", color: tokens.colors.brandDark },
  headingSub: { marginTop: 2, fontSize: 12, color: tokens.colors.textMuted },
  jobCard: {
    position: "relative",
    overflow: "hidden",
    padding: 15,
    paddingLeft: 19,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    ...tokens.shadow.card,
  },
  jobAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: tokens.colors.brandLight,
  },
  jobTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  jobIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.brandSoft,
  },
  jobCopy: { flex: 1, minWidth: 0 },
  jobTitle: { fontSize: 16, fontWeight: "800", color: tokens.colors.brandDark },
  jobStatus: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: tokens.colors.brand,
  },
  jobMeta: { marginTop: 13, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaItemText: { maxWidth: 170, fontSize: 11, color: tokens.colors.textMuted },
  jobStats: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  jobStat: { fontSize: 12, color: tokens.colors.textMuted },
  jobStatValue: { color: tokens.colors.brandDark, fontWeight: "800" },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.textSubtle,
  },
  backRow: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  backText: { color: tokens.colors.brand, fontSize: 13, fontWeight: "800" },
  selectedJobCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: tokens.colors.brandDark,
    ...tokens.shadow.card,
  },
  selectedTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "800",
    color: tokens.colors.white,
  },
  metaLine: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: { flex: 1, color: tokens.colors.onBrandMuted, fontSize: 12 },
  summaryRow: { marginTop: 15, flexDirection: "row", gap: 8 },
  summary: {
    flex: 1,
    minHeight: 66,
    padding: 9,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,.12)",
  },
  summaryValue: { color: tokens.colors.white, fontSize: 18, fontWeight: "900" },
  summaryLabel: {
    marginTop: 3,
    color: tokens.colors.onBrandMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
  },
  stageTabs: { paddingVertical: 2, gap: 7 },
  stageTab: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stageTabActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  stageText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.textMuted,
  },
  stageTextActive: { color: tokens.colors.white },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.contentMuted,
  },
  countBadgeActive: { backgroundColor: "rgba(255,255,255,.2)" },
  countText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.colors.textMuted,
  },
  countTextActive: { color: tokens.colors.white },
  candidateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    overflow: "hidden",
    ...tokens.shadow.card,
  },
  candidateExpanded: { borderColor: tokens.colors.brandMuted },
  candidateTap: {
    minHeight: 92,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: tokens.colors.brandSoft,
  },
  avatarImage: { width: 50, height: 50 },
  avatarText: { fontSize: 16, fontWeight: "900", color: tokens.colors.brand },
  candidateCopy: { flex: 1, minWidth: 0 },
  candidateName: {
    fontSize: 15,
    fontWeight: "800",
    color: tokens.colors.brandDark,
  },
  appliedDate: { marginTop: 2, fontSize: 11, color: tokens.colors.textMuted },
  candidatePills: {
    marginTop: 7,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: tokens.colors.contentMuted,
  },
  pillBlue: { backgroundColor: tokens.colors.brandSoft },
  pillGold: { backgroundColor: tokens.colors.warningSoft },
  pillText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.colors.onCanvasMuted,
  },
  expandedBody: {
    padding: 13,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  actionGrid: { marginTop: 13, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    minHeight: 46,
    minWidth: "46%",
    flexGrow: 1,
    borderRadius: 13,
    backgroundColor: tokens.colors.brandSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  actionText: { fontSize: 11, fontWeight: "800", color: tokens.colors.brand },
  infoPanel: {
    marginTop: 11,
    padding: 11,
    borderRadius: 13,
    backgroundColor: tokens.colors.infoSoft,
    flexDirection: "row",
    gap: 8,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: tokens.colors.brandDark,
  },
  infoText: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 15,
    color: tokens.colors.textMuted,
  },
  offerPanel: {
    marginTop: 11,
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.colors.brandDark,
  },
  panelHelp: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: tokens.colors.textMuted,
  },
  inputAction: { marginTop: 9, flexDirection: "row", gap: 7 },
  compactInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 11,
    color: tokens.colors.text,
    fontSize: 12,
  },
  primarySmall: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  primarySmallText: {
    color: tokens.colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  secondarySmall: {
    minHeight: 46,
    maxWidth: 125,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.brandMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  secondarySmallText: {
    color: tokens.colors.brand,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  escrowText: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    color: tokens.colors.brand,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: tokens.colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryButton: {
    marginTop: 9,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tokens.colors.brandMuted,
    backgroundColor: tokens.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    color: tokens.colors.brand,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  twoActions: { marginTop: 9, flexDirection: "row", gap: 8 },
  dangerOutline: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: { color: "#B91C1C", fontSize: 11, fontWeight: "800" },
  rejectButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: tokens.colors.dangerSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rejectText: { color: "#B91C1C", fontSize: 11, fontWeight: "800" },
  removeButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    color: tokens.colors.textMuted,
    fontSize: 10,
    textDecorationLine: "underline",
  },
  busy: { marginVertical: 6 },
  disabled: { opacity: tokens.opacity.disabled },
  errorCard: {
    minHeight: 60,
    padding: 12,
    borderRadius: 14,
    backgroundColor: tokens.colors.dangerSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 11, color: "#991B1B" },
  retry: {
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: "#991B1B", fontWeight: "800", fontSize: 11 },
  empty: {
    minHeight: 220,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "800",
    color: tokens.colors.brandDark,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textMuted,
    textAlign: "center",
  },
  skeleton: { gap: 10 },
  skeletonCard: {
    height: 126,
    borderRadius: 18,
    backgroundColor: tokens.colors.contentMuted,
  },
  modalBackdrop: {
    flex: 1,
    padding: 18,
    backgroundColor: "rgba(15,41,84,.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterSheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    padding: 18,
    borderRadius: 22,
    backgroundColor: tokens.colors.surface,
  },
  interviewSheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92%",
    padding: 18,
    borderRadius: 22,
    backgroundColor: tokens.colors.surface,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sheetTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: "800",
    color: tokens.colors.brandDark,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    marginTop: 14,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: "800",
    color: tokens.colors.brandDark,
  },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  choiceText: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  choiceTextActive: { color: tokens.colors.white },
  dateButton: {
    flex: 1,
    minHeight: 48,
    marginTop: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dateText: { color: tokens.colors.text, fontSize: 11, fontWeight: "700" },
  sheetInput: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    color: tokens.colors.text,
  },
  notes: { minHeight: 76, paddingTop: 11, textAlignVertical: "top" },
});
