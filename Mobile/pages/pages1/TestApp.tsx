import React, { useState } from 'react';
import { View } from 'react-native';
import Dashboard from './dashboard';
import Jobs from './Jobs';
import SavedJobs from './SavedJobs';
import JobDetails from './JobDetails';

type Job = {
  _id: string;
  title: string;
  description: string;
  location: string;
  salary: string;
  jobType: string;
  urgent?: boolean;
  skills?: string[];
  createdAt?: string;
  category?: { _id: string; name: string } | string;
  jobPoster?: { firstName?: string; lastName?: string; email?: string };
};

type SavedJob = {
  _id: string;
  title: string;
  company: string;
  location: string;
  tags: string[];
  salary: string;
  logo?: string;
};

export default function AppExample() {
  const [currentScreen, setCurrentScreen] = useState<'Dashboard' | 'Jobs' | 'SavedJobs' | 'JobDetails'>('Dashboard');
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Home');

  const handleNavigateToJobs = () => {
    console.log('Navigating to Jobs page...');
    setCurrentScreen('Jobs');
  };

  const handleBackToDashboard = () => {
    console.log('Navigating back to Dashboard...');
    setCurrentScreen('Dashboard');
  };

  const handleSaveJob = (job: Job) => {
    console.log('Saving job:', job);
    const exists = savedJobs.some(j => j._id === job._id);
    if (!exists) {
      // Extract company name from jobPoster or category
      const companyName = job.jobPoster
        ? `${job.jobPoster.firstName || ''} ${job.jobPoster.lastName || ''}`.trim()
        : typeof job.category === 'object' 
          ? job.category.name 
          : 'Unknown Company';
      
      const newSavedJob: SavedJob = {
        _id: job._id,
        title: job.title,
        company: companyName,
        location: job.location || 'Pangasinan, PH',
        tags: job.skills || [],
        salary: job.salary,
      };
      setSavedJobs([...savedJobs, newSavedJob]);
    }
  };

  const handleRemoveJob = (jobId: string) => {
    console.log('Removing job:', jobId);
    setSavedJobs(savedJobs.filter(job => job._id !== jobId));
  };

  const handleViewDetails = (job: Job) => {
    console.log('Viewing job details:', job);
    setSelectedJob(job);
    setCurrentScreen('JobDetails');
  };

  const handleViewSavedJobDetails = (job: SavedJob) => {
    console.log('Viewing saved job details:', job);
    // Convert SavedJob to Job format
    const jobData: Job = {
      _id: job._id,
      title: job.title,
      description: '',
      location: job.location,
      salary: job.salary,
      jobType: '',
      skills: job.tags,
    };
    setSelectedJob(jobData);
    setCurrentScreen('JobDetails');
  };

  const handleNavigateToSavedJobs = () => {
    console.log('Navigating to Saved Jobs...');
    setCurrentScreen('SavedJobs');
  };

  if (currentScreen === 'JobDetails' && selectedJob) {
    return (
      <JobDetails
        job={selectedJob}
        onBack={() => setCurrentScreen('Jobs')}
        onSaveJob={handleSaveJob}
        isSaved={savedJobs.some(j => j._id === selectedJob._id)}
        activeTab={activeTab}
        onTabPress={(tab) => {
          setActiveTab(tab);
          if (tab === 'Home') {
            setCurrentScreen('Dashboard');
          } else if (tab === 'Jobs') {
            setCurrentScreen('Jobs');
          } else if (tab === 'Saved') {
            setCurrentScreen('SavedJobs');
          }
        }}
      />
    );
  }

  if (currentScreen === 'SavedJobs') {
    return (
      <SavedJobs
        savedJobs={savedJobs}
        onRemoveJob={handleRemoveJob}
        onViewDetails={handleViewSavedJobDetails}
        activeTab={activeTab}
        onTabPress={(tab) => {
          setActiveTab(tab);
          if (tab === 'Home') {
            setCurrentScreen('Dashboard');
          } else if (tab === 'Jobs') {
            setCurrentScreen('Jobs');
          }
        }}
      />
    );
  }

  if (currentScreen === 'Jobs') {
    return (
      <Jobs 
        onBack={handleBackToDashboard}
        onViewDetails={handleViewDetails}
        onToggleSave={handleSaveJob}
        savedJobIds={savedJobs.map(j => j._id)}
      />
    );
  }

  return (
    <Dashboard 
      onNavigateToJobs={handleNavigateToJobs}
      onLogout={() => {
        console.log('Logout clicked');
      }}
      activeTab={activeTab}
      onTabPress={(tab) => {
        setActiveTab(tab);
        setCurrentScreen('Dashboard');
        if (tab === 'Saved') {
          setCurrentScreen('SavedJobs');
        } else if (tab === 'Jobs') {
          setCurrentScreen('Jobs');
        }
      }}
    />
  );
}
