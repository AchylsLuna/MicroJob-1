import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Search } from "lucide-react";
import { Button, Dialog, Select } from "../ui";
import { getMessageRecipients, type MessageRecipient, type MessageRecipientDirectory } from "../../services/api";

type Audience = "all" | "admins" | "users";

export function RecipientDirectoryDialog({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (recipient: MessageRecipient) => void;
}) {
  const { t } = useTranslation("admin");
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState<MessageRecipientDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      getMessageRecipients({ search: search.trim(), audience, page }, controller.signal)
        .then((result) => { if (!cancelled) setDirectory(result); })
        .catch(() => { if (!cancelled) setError(t("messageDirectory.loadFailed")); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [search, audience, page, retry, t]);

  const currentPage = directory?.page || 1;
  const pageCount = directory?.pageCount || 1;

  return (
    <Dialog open size="xl" title={t("messageDirectory.title")} description={t("messageDirectory.description")} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <label htmlFor={searchId} className="mb-2 block text-sm font-semibold text-slate-700">{t("messageDirectory.searchLabel")}</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id={searchId} type="search" value={search} maxLength={100} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("messageDirectory.searchPlaceholder")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>
        <Select label={t("messageDirectory.groupLabel")} value={audience} onChange={(event) => { setAudience(event.target.value as Audience); setPage(1); }}>
          <option value="all">{t("messageDirectory.groups.all")}</option>
          <option value="admins">{t("messageDirectory.groups.admins")}</option>
          <option value="users">{t("messageDirectory.groups.users")}</option>
        </Select>
      </div>
      <div className="mt-5" aria-busy={loading}>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">{t("messageDirectory.loading")}</p> : error ? (
          <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p><Button className="mt-3" onClick={() => setRetry((current) => current + 1)}>{t("messageDirectory.retry")}</Button>
          </div>
        ) : !directory?.recipients.length ? <p role="status" className="py-8 text-center text-sm text-slate-500">{t("messageDirectory.empty")}</p> : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">{t("messageDirectory.tableCaption")}</caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("messageDirectory.person")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("messageDirectory.role")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("messageDirectory.action")}</th>
                </tr></thead>
                <tbody>{directory.recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-b border-slate-100 last:border-b-0">
                    <th scope="row" className="px-4 py-3"><span className="block font-semibold text-slate-900">{recipient.name}</span><span className="mt-1 block break-all text-xs font-normal text-slate-500">{recipient.email}</span></th>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${recipient.isStaff ? "bg-brand-50 text-brand" : "bg-slate-100 text-slate-700"}`}>{t(`messageDirectory.roles.${recipient.role}`, { defaultValue: recipient.role.replace(/_/g, " ") })}</span></td>
                    <td className="px-4 py-3"><Button aria-label={t("messageDirectory.messagePerson", { name: recipient.name })} onClick={() => onSelect(recipient)}><MessageSquare aria-hidden="true" className="h-4 w-4" />{t("messageDirectory.message")}</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm text-slate-500">{t("messageDirectory.showing", { from: (currentPage - 1) * directory.pageSize + 1, to: Math.min(currentPage * directory.pageSize, directory.total), total: directory.total })}</p>
              {pageCount > 1 ? <nav aria-label={t("messageDirectory.paginationLabel")} className="flex items-center gap-3">
                <Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t("messageDirectory.previous")}</Button>
                <span className="text-sm text-slate-600">{t("messageDirectory.page", { page: currentPage, total: pageCount })}</span>
                <Button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>{t("messageDirectory.next")}</Button>
              </nav> : null}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
