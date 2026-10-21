export const conversationLink = (audience, participantId, jobId) =>
  `/${audience}/messages?startUser=${encodeURIComponent(String(participantId))}&jobId=${encodeURIComponent(String(jobId))}`;

export const assignmentLink = (audience, applicationId, jobId) =>
  `/${audience}/${audience === 'employer' ? 'applications' : 'applied-jobs'}?applicationId=${encodeURIComponent(String(applicationId))}${jobId ? `&jobId=${encodeURIComponent(String(jobId))}` : ''}`;

export const disputeLink = (audience, disputeId) =>
  `/${audience}/financial-disputes?disputeId=${encodeURIComponent(String(disputeId))}`;
