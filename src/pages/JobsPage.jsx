import { useState, useEffect } from 'react';
import api from '@services/api';
import SuccessNotification from '@components/shared/SuccessNotification';
import './JobsPage.css';

const JobsPage = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState('board');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Profile preferences state
  const [profile, setProfile] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    targetRoles: '',
    experienceLevel: 'fresher',
    targetLocation: '',
    resumeText: '',
    exaApiKey: '',
    resumes: []
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Resume Upload states
  const [uploadingResume, setUploadingResume] = useState(false);

  // Search states
  const [searchTab, setSearchTab] = useState('term'); // term | url
  const [searchTerm, setSearchTerm] = useState('');
  const [searchUrl, setSearchUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [termResults, setTermResults] = useState([]);
  const [scrapedDetails, setScrapedDetails] = useState(null);

  // Job board states
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [history, setHistory] = useState([]);

  // Selected resumes for each job
  const [jobResumes, setJobResumes] = useState({});

  // WhatsApp states
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qrCode: '' });
  const [triggeringApply, setTriggeringApply] = useState(false);
  const [scrapingJobId, setScrapingJobId] = useState(null);

  // Automation Scheduler states
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskType, setTaskType] = useState('apply'); // 'apply' | 'message' | 'search'
  const [taskTime, setTaskTime] = useState('09:00');
  const [taskQuery, setTaskQuery] = useState('');
  const [taskPhone, setTaskPhone] = useState('');
  const [taskMessage, setTaskMessage] = useState('');

  // Manual Custom Outreach generator states
  const [generatingManual, setGeneratingManual] = useState(false);
  const [manualJobTitle, setManualJobTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualJobDesc, setManualJobDesc] = useState('');
  const [manualResumeId, setManualResumeId] = useState('');
  const [manualOutreach, setManualOutreach] = useState(null);

  // Toast / Notification state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('Configuration saved!');

  // Card view templates state (expansion tracker)
  const [expandedOutreach, setExpandedOutreach] = useState({});

  useEffect(() => {
    fetchInitialData();
    // Poll WhatsApp status every 5 seconds
    const interval = setInterval(fetchWaStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      const [profileRes, jobsRes, historyRes, tasksRes] = await Promise.all([
        api.get('/jobs/profile').catch(() => ({ data: {} })),
        api.get('/jobs').catch(() => ({ data: [] })),
        api.get('/jobs/history').catch(() => ({ data: [] })),
        api.get('/jobs/tasks').catch(() => ({ data: [] }))
      ]);

      if (profileRes.data) {
        setProfile({
          userName: profileRes.data.userName || '',
          userEmail: profileRes.data.userEmail || '',
          userPhone: profileRes.data.userPhone || '',
          targetRoles: profileRes.data.targetRoles ? profileRes.data.targetRoles.join(', ') : '',
          experienceLevel: profileRes.data.experienceLevel || 'fresher',
          targetLocation: profileRes.data.targetLocation || '',
          resumeText: profileRes.data.resumeText || '',
          exaApiKey: profileRes.data.exaApiKey || '',
          resumes: profileRes.data.resumes || []
        });
      }

      setJobs(jobsRes.data || []);
      setHistory(historyRes.data || []);
      setTasks(tasksRes.data || []);
      setLoadingJobs(false);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setLoadingJobs(false);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const res = await api.get('/jobs/whatsapp/status');
      setWaStatus(res.data);
    } catch (err) {
      console.error('Failed to get WhatsApp status:', err);
    }
  };

  const handleConnectWhatsApp = async () => {
    try {
      setSuccessMsg('Connecting WhatsApp Web client...');
      setShowSuccess(true);
      const res = await api.post('/jobs/whatsapp/connect');
      setWaStatus(res.data);
    } catch (err) {
      console.error('Failed to connect WhatsApp:', err);
      alert('Failed to connect WhatsApp');
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      if (!window.confirm('Disconnect WhatsApp? This will clear your current session.')) return;
      setSuccessMsg('Disconnecting WhatsApp client...');
      setShowSuccess(true);
      const res = await api.post('/jobs/whatsapp/disconnect');
      setWaStatus(res.data);
    } catch (err) {
      console.error('Failed to disconnect WhatsApp:', err);
      alert('Failed to disconnect WhatsApp');
    }
  };

  // Profile preferences submit handler
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const rolesArray = profile.targetRoles.split(',').map(r => r.trim()).filter(r => r);
      await api.put('/jobs/profile', {
        ...profile,
        targetRoles: rolesArray
      });
      setSuccessMsg('Configuration saved!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  // Resume Bank uploader handler
  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (profile.resumes && profile.resumes.length >= 6) {
      alert('You can upload a maximum of 6 resumes. Please delete one before uploading a new one.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    try {
      setUploadingResume(true);
      const res = await api.post('/jobs/profile/resume/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data) {
        setProfile(prev => ({
          ...prev,
          resumes: res.data.resumes || []
        }));
      }
      setSuccessMsg('Resume parsed and uploaded successfully!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Resume upload failed:', err);
      alert(err.response?.data?.error || 'Failed to upload and parse resume');
    } finally {
      setUploadingResume(false);
      e.target.value = null; // reset input
    }
  };

  // Resume Bank delete handler
  const handleDeleteResume = async (resumeId) => {
    if (!window.confirm('Delete this resume?')) return;
    try {
      const res = await api.delete(`/jobs/profile/resume/${resumeId}`);
      if (res.data) {
        setProfile(prev => ({
          ...prev,
          resumes: res.data.resumes || []
        }));
      }
      setSuccessMsg('Resume deleted!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to delete resume:', err);
      alert('Failed to delete resume');
    }
  };

  // Search Engine: Term search submit handler
  const handleTermSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    try {
      setSearching(true);
      setTermResults([]);
      const res = await api.get(`/jobs/search/term?query=${encodeURIComponent(searchTerm)}`);
      setTermResults(res.data.results || []);
      const historyRes = await api.get('/jobs/history');
      setHistory(historyRes.data || []);
    } catch (err) {
      console.error('Term search failed:', err);
      alert(err.response?.data?.error || 'Exa search query failed. Check your Exa API key.');
    } finally {
      setSearching(false);
    }
  };

  // Search Engine: Scrape Careers URL submit handler
  const handleUrlSearch = async (e) => {
    e.preventDefault();
    if (!searchUrl.trim()) return;

    try {
      setSearching(true);
      setScrapedDetails(null);
      const res = await api.post('/jobs/search/url', { url: searchUrl });
      setScrapedDetails(res.data);
      const historyRes = await api.get('/jobs/history');
      setHistory(historyRes.data || []);
    } catch (err) {
      console.error('URL search failed:', err);
      alert(err.response?.data?.error || 'Failed to analyze Careers site. Check your Exa API key.');
    } finally {
      setSearching(false);
    }
  };

  // Search Engine: Import job opening to pipeline
  const handleAddJob = async (title, company, url, desc = '', email = '', phone = '', emails = [], phones = []) => {
    try {
      const res = await api.post('/jobs', {
        title,
        company,
        url,
        description: desc,
        contactEmail: email,
        contactNumber: phone,
        contactEmails: emails,
        contactNumbers: phones,
        status: 'to-apply'
      });
      setJobs(prev => [res.data, ...prev]);
      setSuccessMsg('Added to outreach pipeline!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to add job:', err);
      alert('Failed to add job to list');
    }
  };

  // Job board: manual run apply scheduler checker
  const handleManualTrigger = async () => {
    try {
      setTriggeringApply(true);
      const res = await api.post('/jobs/trigger-apply');
      const count = res.data.appliedCount || 0;
      setSuccessMsg(`Triggered! Applied to ${count} jobs.`);
      setShowSuccess(true);
      const jobsRes = await api.get('/jobs');
      setJobs(jobsRes.data || []);
    } catch (err) {
      console.error('Failed to trigger manual apply:', err);
      alert('Outreach trigger failed. Add some "To Apply" jobs first!');
    } finally {
      setTriggeringApply(false);
    }
  };

  // Job board: delete a job card
  const handleDeleteJob = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Remove this job?')) return;
    try {
      await api.delete(`/jobs/${id}`);
      setJobs(prev => prev.filter(j => j._id !== id));
      setSuccessMsg('Job removed!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  // Job board: update job status to applied
  const handleMarkApplied = async (id) => {
    try {
      const res = await api.put(`/jobs/${id}`, { status: 'applied' });
      setJobs(prev => prev.map(j => j._id === id ? res.data : j));
      setSuccessMsg('Marked as applied!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Job board: move job back to To Apply status
  const handleMarkToApply = async (id) => {
    try {
      const res = await api.put(`/jobs/${id}`, { status: 'to-apply' });
      setJobs(prev => prev.map(j => j._id === id ? res.data : j));
      setSuccessMsg('Moved back to To Apply!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Store selected resume overrides for each job card
  const handleSelectResumeForJob = (jobId, resumeId) => {
    setJobResumes(prev => ({ ...prev, [jobId]: resumeId }));
  };

  // Job board: generate or regenerate outreach using matched resume
  const handleGenerateOutreach = async (jobId) => {
    try {
      const selectedResumeId = jobResumes[jobId];
      const res = await api.post(`/jobs/${jobId}/generate`, { resumeId: selectedResumeId || undefined });
      setJobs(prev => prev.map(j => j._id === jobId ? res.data : j));
      setSuccessMsg('Outreach drafted successfully!');
      setShowSuccess(true);
      setExpandedOutreach(prev => ({ ...prev, [jobId]: true }));
    } catch (err) {
      console.error('Failed to generate outreach:', err);
      alert(err.response?.data?.error || 'Failed to generate outreach. Make sure profile details are saved and you have uploaded resumes.');
    }
  };

  // Job board: deeply scrape recruiter contacts using headless browser
  const handleDeepScrape = async (jobId) => {
    try {
      setScrapingJobId(jobId);
      setSuccessMsg('Deep scraping careers site for recruiter emails and numbers (takes 10-25s)...');
      setShowSuccess(true);
      const res = await api.post(`/jobs/${jobId}/deep-scrape`);
      setJobs(prev => prev.map(j => j._id === jobId ? res.data : j));
      setSuccessMsg('Deep scraping finished! Recruiter contacts updated.');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to deep scrape:', err);
      alert(err.response?.data?.error || 'Failed to scrape recruiter contacts.');
    } finally {
      setScrapingJobId(null);
    }
  };

  // Job Board card actions: Open Gmail & Apply (evaluates and selects resume first if needed)
  const handleOpenGmailAndApply = async (job) => {
    let targetJob = job;
    
    // 1. Check if contact email is missing, and if so, prompt user
    if (!targetJob.contactEmail && (!targetJob.contactEmails || targetJob.contactEmails.length === 0)) {
      const inputEmail = window.prompt(
        "Email address is missing. Please enter recruiter's contact email(s) (comma-separated if multiple):",
        ""
      );
      if (inputEmail === null) return; // cancelled
      const trimmedEmail = inputEmail.trim();
      if (!trimmedEmail) {
        alert("Email address is required to open Gmail outreach!");
        return;
      }
      
      const emailList = trimmedEmail.split(',').map(e => e.trim()).filter(e => e);
      try {
        setSuccessMsg('Saving contact email...');
        setShowSuccess(true);
        const updateRes = await api.put(`/jobs/${job._id}`, { 
          contactEmail: emailList[0],
          contactEmails: emailList
        });
        targetJob = updateRes.data;
        // update local state
        setJobs(prev => prev.map(j => j._id === job._id ? updateRes.data : j));
      } catch (err) {
        console.error('Failed to save contact email:', err);
        alert('Failed to update contact email in database.');
        return;
      }
    }
    
    // 2. Check if outreach needs generation or regeneration (if selected resume differs from appliedResumeId)
    const selectedResumeId = jobResumes[job._id];
    const needsRegeneration = (selectedResumeId !== undefined && selectedResumeId !== (targetJob.appliedResumeId || '')) || (!targetJob.aiEmailSubject || !targetJob.aiEmailBody);
    
    if (needsRegeneration) {
      try {
        setSuccessMsg('AI reading resume and drafting email outreach...');
        setShowSuccess(true);
        const res = await api.post(`/jobs/${job._id}/generate`, { resumeId: selectedResumeId || undefined });
        targetJob = res.data;
        setJobs(prev => prev.map(j => j._id === job._id ? res.data : j));
      } catch (err) {
        console.error('Failed to generate outreach on the fly:', err);
        alert('Failed to draft outreach. Please configure your profile preferences first!');
        return;
      }
    }
    
    // 3. Auto-dispatch a WhatsApp message in the background if client is connected and a phone number is available
    const phones = targetJob.contactNumbers && targetJob.contactNumbers.length > 0 ? targetJob.contactNumbers : (targetJob.contactNumber ? [targetJob.contactNumber] : []);
    if (waStatus.status === 'connected' && phones.length > 0) {
      try {
        console.log('Dispatching WhatsApp message in background since client is connected...');
        await api.post(`/jobs/${targetJob._id}/send-whatsapp`);
      } catch (wsErr) {
        console.warn('Failed to send background WhatsApp message:', wsErr.message);
      }
    }
    
    // 4. Open Gmail composer
    window.open(getGmailLink(targetJob), '_blank');
    setSuccessMsg("Gmail composer opened! Please attach your resume PDF manually using the paperclip icon in Gmail.");
    setShowSuccess(true);
    handleMarkApplied(targetJob._id);
  };

  // Job Board card actions: Send WhatsApp & Apply (evaluates and selects resume first if needed)
  const handleSendWhatsAppAndApply = async (job) => {
    let targetJob = job;
    
    // 1. Check if contact number is missing, and if so, prompt user
    if (!targetJob.contactNumber && (!targetJob.contactNumbers || targetJob.contactNumbers.length === 0)) {
      const inputNumber = window.prompt(
        "WhatsApp number is missing. Please enter recruiter's phone/WhatsApp number(s) (comma-separated if multiple):",
        ""
      );
      if (inputNumber === null) return; // cancelled
      const trimmedNumber = inputNumber.trim();
      if (!trimmedNumber) {
        alert("WhatsApp number is required to send outreach!");
        return;
      }
      
      const phoneList = trimmedNumber.split(',').map(p => p.trim()).filter(p => p);
      try {
        setSuccessMsg('Saving contact number...');
        setShowSuccess(true);
        const updateRes = await api.put(`/jobs/${job._id}`, { 
          contactNumber: phoneList[0],
          contactNumbers: phoneList
        });
        targetJob = updateRes.data;
        // update local state
        setJobs(prev => prev.map(j => j._id === job._id ? updateRes.data : j));
      } catch (err) {
        console.error('Failed to save contact number:', err);
        alert('Failed to update contact number in database.');
        return;
      }
    }
    
    // 2. Check if outreach needs generation or regeneration (if selected resume differs from appliedResumeId)
    const selectedResumeId = jobResumes[job._id];
    const needsRegeneration = (selectedResumeId !== undefined && selectedResumeId !== (targetJob.appliedResumeId || '')) || (!targetJob.aiWhatsAppMsg);
    
    if (needsRegeneration) {
      try {
        setSuccessMsg('AI reading resume and drafting WhatsApp pitch...');
        setShowSuccess(true);
        const res = await api.post(`/jobs/${job._id}/generate`, { resumeId: selectedResumeId || undefined });
        targetJob = res.data;
        setJobs(prev => prev.map(j => j._id === job._id ? res.data : j));
      } catch (err) {
        console.error('Failed to generate outreach on the fly:', err);
        alert('Failed to draft WhatsApp message. Please check preferences first!');
        return;
      }
    }
    
    // 3. Dispatch the message
    // If WhatsApp is connected, send it via server-side client!
    if (waStatus.status === 'connected') {
      try {
        setSuccessMsg('Sending WhatsApp message via background client...');
        setShowSuccess(true);
        const sendRes = await api.post(`/jobs/${targetJob._id}/send-whatsapp`);
        // update local state with applied status
        setJobs(prev => prev.map(j => j._id === job._id ? sendRes.data : j));
        setSuccessMsg('WhatsApp message sent successfully!');
        setShowSuccess(true);
      } catch (err) {
        console.error('Failed to send server-side WhatsApp message:', err);
        // Fallback to manual if server-side send fails
        const proceedManual = window.confirm(
          `Failed to send WhatsApp via server client: ${err.response?.data?.error || err.message}. Fall back to opening WhatsApp Web manually?`
        );
        if (proceedManual) {
          triggerManualWhatsApp(targetJob);
        }
      }
    } else {
      // Offline fallback: open wa.me link
      triggerManualWhatsApp(targetJob);
    }
  };

  // Helper to open manual WhatsApp redirect for all phone numbers
  const triggerManualWhatsApp = (targetJob) => {
    const phones = targetJob.contactNumbers && targetJob.contactNumbers.length > 0 ? targetJob.contactNumbers : (targetJob.contactNumber ? [targetJob.contactNumber] : []);
    if (phones.length > 1) {
      const proceed = window.confirm(`WhatsApp offline. Found ${phones.length} numbers. Open browser tabs for all?`);
      if (!proceed) return;
    }
    phones.forEach(phone => {
      const text = encodeURIComponent(targetJob.aiWhatsAppMsg || '');
      const url = `https://wa.me/${phone.replace(/[+\s-]/g, '')}?text=${text}`;
      window.open(url, '_blank');
    });
    handleMarkApplied(targetJob._id);
  };

  // Automation Scheduler: Add task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      setCreatingTask(true);
      const data = {};
      if (taskType === 'search') {
        if (!taskQuery.trim()) {
          alert('Please specify a search query.');
          return;
        }
        data.query = taskQuery;
      } else if (taskType === 'message') {
        if (!taskPhone.trim() || !taskMessage.trim()) {
          alert('Please specify recipient phone and message text.');
          return;
        }
        data.phone = taskPhone;
        data.messageText = taskMessage;
      }

      const res = await api.post('/jobs/tasks', {
        type: taskType,
        time: taskTime,
        data
      });

      setTasks(prev => [...prev, res.data].sort((a, b) => a.time.localeCompare(b.time)));
      setSuccessMsg('Automation task scheduled!');
      setShowSuccess(true);
      setTaskQuery('');
      setTaskPhone('');
      setTaskMessage('');
    } catch (err) {
      console.error('Failed to create task:', err);
      alert(err.response?.data?.error || 'Failed to schedule task');
    } finally {
      setCreatingTask(false);
    }
  };

  // Automation Scheduler: Toggle task active status
  const handleToggleTask = async (taskId) => {
    try {
      const res = await api.patch(`/jobs/tasks/${taskId}`);
      setTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
      setSuccessMsg('Task status updated!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  // Automation Scheduler: Delete task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/jobs/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
      setSuccessMsg('Task removed!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Manual Outreach view: generate custom outreach draft
  const handleManualDraftSubmit = async (e) => {
    e.preventDefault();
    if (!manualJobTitle.trim() || !manualCompany.trim()) {
      alert('Please enter job title and company.');
      return;
    }
    try {
      setGeneratingManual(true);
      const res = await api.post('/jobs/profile/manual-draft', {
        title: manualJobTitle,
        company: manualCompany,
        description: manualJobDesc,
        resumeId: manualResumeId || undefined
      });
      setManualOutreach(res.data);
      setSuccessMsg('Custom draft generated!');
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to generate manual draft:', err);
      alert(err.response?.data?.error || 'Failed to generate manual draft');
    } finally {
      setGeneratingManual(false);
    }
  };

  // Construct mailto link
  const getGmailLink = (job) => {
    const to = (job.contactEmails && job.contactEmails.length > 0) ? job.contactEmails.join(',') : (job.contactEmail || '');
    const subject = encodeURIComponent(job.aiEmailSubject || `Application for ${job.title} - ${profile.userName}`);
    const body = encodeURIComponent(job.aiEmailBody || '');
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
  };

  const getManualGmailLink = () => {
    if (!manualOutreach) return '#';
    const subject = encodeURIComponent(manualOutreach.emailSubject || '');
    const body = encodeURIComponent(manualOutreach.emailBody || '');
    return `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
  };

  // Construct WhatsApp wa.me links
  const getWhatsAppLink = (job) => {
    const phone = job.contactNumber || '';
    const text = encodeURIComponent(job.aiWhatsAppMsg || '');
    return `https://wa.me/${phone.replace(/[+\s-]/g, '')}?text=${text}`;
  };

  const getManualWhatsAppLink = () => {
    if (!manualOutreach) return '#';
    const text = encodeURIComponent(manualOutreach.whatsAppMsg || '');
    return `https://wa.me/?text=${text}`;
  };

  // Toggle outreach details expansion
  const toggleOutreachDetails = (id) => {
    setExpandedOutreach(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy text helper
  const handleCopyText = (text, type = 'Text') => {
    navigator.clipboard.writeText(text);
    setSuccessMsg(`${type} copied to clipboard!`);
    setShowSuccess(true);
  };

  const toApplyJobs = jobs.filter(j => j.status === 'to-apply');
  const manualJobs = jobs.filter(j => j.status === 'manual-review');
  const appliedJobs = jobs.filter(j => j.status === 'applied');

  const tabs = [
    { id: 'board', name: 'Outreach Board', icon: '📋' },
    { id: 'search', name: 'Search Engine', icon: '🔍' },
    { id: 'profile', name: 'Profile & Resumes', icon: '👤' },
    { id: 'scheduler', name: 'Auto Scheduler', icon: '🤖' },
    { id: 'manual', name: 'Manual Outreach', icon: '📧' }
  ];

  const activeTabName = tabs.find(t => t.id === activeTab)?.name || '';

  return (
    <div className="jobs-dashboard-layout">
      {/* Mobile Top Bar */}
      <header className="jobs-mobile-topbar">
        <div className="jobs-mobile-brand">
          <span className="brand-logo">💼</span>
          <span className="brand-name">Outreach Hub</span>
        </div>
        <div className="jobs-mobile-actions">
          <div className={`wa-status-dot ${waStatus.status}`} title={`WhatsApp status: ${waStatus.status}`} />
          <button 
            type="button" 
            className={`hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="jobs-mobile-nav">
          <ul className="jobs-mobile-nav-list">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button
                  type="button"
                  className={`mobile-nav-item-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.name}</span>
                </button>
              </li>
            ))}
          </ul>
          
          <div className="mobile-nav-footer">
            <div className={`whatsapp-status-banner ${waStatus.status}`}>
              <span className="status-indicator-dot" />
              <span className="status-label">
                WhatsApp: {waStatus.status.toUpperCase()}
              </span>
            </div>

            {/* Mobile disconnect controls */}
            <div className="mobile-wa-control-row" style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              {waStatus.status === 'disconnected' ? (
                <button type="button" className="action-btn outline small" onClick={handleConnectWhatsApp}>
                  🔌 Connect WhatsApp
                </button>
              ) : (
                <button type="button" className="action-btn outline small" onClick={handleDisconnectWhatsApp}>
                  🔌 Disconnect WhatsApp
                </button>
              )}
            </div>

            {waStatus.status === 'qr_ready' && waStatus.qrCode && (
              <div className="mobile-nav-qr">
                <p>Scan to connect outbox:</p>
                <img src={waStatus.qrCode} alt="WhatsApp QR Code" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="jobs-sidebar-nav">
        <div className="sidebar-brand">
          <span className="brand-logo">💼</span>
          <span className="brand-name">Outreach Hub</span>
        </div>

        <nav className="sidebar-menu">
          <ul className="sidebar-nav-list">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button
                  type="button"
                  className={`sidebar-nav-item-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          {/* WhatsApp status details */}
          <div className={`whatsapp-badge ${waStatus.status}`}>
            <span className={`status-dot ${waStatus.status === 'connecting' ? 'pulse' : ''}`} />
            <span>
              {waStatus.status === 'connected' && 'WhatsApp: Connected'}
              {waStatus.status === 'disconnected' && 'WhatsApp: Offline'}
              {waStatus.status === 'connecting' && 'WhatsApp: Connecting...'}
              {waStatus.status === 'qr_ready' && 'WhatsApp: Scan QR'}
              {waStatus.status === 'failed' && 'WhatsApp: Failed'}
            </span>
          </div>

          {/* Desktop disconnect controls */}
          <div className="whatsapp-control-row" style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            {waStatus.status === 'disconnected' ? (
              <button type="button" className="wa-control-btn connect" onClick={handleConnectWhatsApp}>
                🔌 Connect
              </button>
            ) : (
              <button type="button" className="wa-control-btn disconnect" onClick={handleDisconnectWhatsApp}>
                🔌 Disconnect
              </button>
            )}
          </div>

          {waStatus.status === 'qr_ready' && waStatus.qrCode && (
            <div className="sidebar-qr-box">
              <img src={waStatus.qrCode} alt="QR Code" className="sidebar-qr-img" />
              <span className="sidebar-qr-tip">Scan using Linked Devices</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Dashboard Panel */}
      <main className="jobs-dashboard-content">
        {/* Active View Header */}
        <div className="content-header">
          <div className="header-title-section">
            <h2>{activeTabName}</h2>
            <p className="header-subtitle">
              {activeTab === 'board' && 'Manage your target jobs pipeline and outreach status'}
              {activeTab === 'search' && 'Search job roles and analyze culture/reviews via Exa'}
              {activeTab === 'profile' && 'Configure preferences and manage your parsed resume bank'}
              {activeTab === 'scheduler' && 'Configure and schedule daily automated outreach cron tasks'}
              {activeTab === 'manual' && 'Compose customized recruiter outreach templates on the fly'}
            </p>
          </div>
        </div>

        {/* Dynamic Panel Content */}
        <div className="content-view-panel">
          
          {/* ────────────────── Outreach Board View ────────────────── */}
          {activeTab === 'board' && (
            <div className="board-view-container animate-fade-in">
              {/* Quick Trigger Header Banner */}
              <div className="jobs-panel board-actions-panel">
                <div className="board-actions-text">
                  <h3>🤖 Daily Outreach Automation</h3>
                  <p>
                    Runs scheduled tasks automatically. You can also trigger the scheduler manually to process all active "To Apply" jobs.
                  </p>
                </div>
                <button
                  type="button"
                  className="action-btn primary manual-trigger-btn"
                  onClick={handleManualTrigger}
                  disabled={triggeringApply || toApplyJobs.length === 0}
                >
                  {triggeringApply ? (
                    <>
                      <div className="spinner mini" />
                      <span>Sending Outreach...</span>
                    </>
                  ) : (
                    '🚀 Run Outreach Manually'
                  )}
                </button>
              </div>

              {/* QR scanner block on board view if WhatsApp not connected */}
              {waStatus.status === 'qr_ready' && waStatus.qrCode && (
                <div className="jobs-panel qr-warning-panel">
                  <div className="qr-warning-text">
                    <h4>📱 Scan WhatsApp Web QR Code</h4>
                    <p>To enable automated WhatsApp outreach, scan the QR code using Link Devices in WhatsApp.</p>
                  </div>
                  <div className="qr-warning-img-box">
                    <img src={waStatus.qrCode} alt="WhatsApp QR" />
                  </div>
                </div>
              )}

              {/* Board Columns Grid */}
              {loadingJobs ? (
                <div className="loading-box">
                  <div className="spinner" />
                  <span>Loading target pipeline...</span>
                </div>
              ) : (
                <div className="jobs-board-columns">
                  
                  {/* Column 1: To Apply */}
                  <div className="jobs-column">
                    <div className="column-header">
                      <div className="header-title-wrap">
                        <span className="column-icon">📝</span>
                        <h3>To Apply</h3>
                      </div>
                      <span className="column-count">{toApplyJobs.length}</span>
                    </div>

                    <div className="jobs-card-list">
                      {toApplyJobs.length === 0 ? (
                        <div className="empty-column-box">
                          <p>Add jobs from the Search Engine to begin building your outreach pipeline!</p>
                        </div>
                      ) : (
                        toApplyJobs.map(job => {
                          const hasOutreach = job.aiEmailSubject && job.aiEmailBody;
                          const isExpanded = expandedOutreach[job._id];

                          return (
                            <div key={job._id} className="job-outreach-card">
                              <div className="job-card-header">
                                <div className="job-card-title">
                                  <h4>{job.title}</h4>
                                  <p className="company-tag">🏢 {job.company}</p>
                                </div>
                                <button
                                  type="button"
                                  className="job-delete-card-btn"
                                  onClick={(e) => handleDeleteJob(job._id, e)}
                                  title="Delete job"
                                >
                                  &times;
                                </button>
                              </div>

                              {job.description && (
                                <p className="job-card-desc">{job.description}</p>
                              )}

                              {/* Target Resume selector dropdown inside job card */}
                              <div className="job-card-resume-select">
                                <span className="select-icon">📄</span>
                                <select
                                  id={`resume-select-${job._id}`}
                                  value={jobResumes[job._id] !== undefined ? jobResumes[job._id] : (job.appliedResumeId || '')}
                                  onChange={(e) => handleSelectResumeForJob(job._id, e.target.value)}
                                >
                                  <option value="">Auto-Select best match (AI)</option>
                                  {profile.resumes && profile.resumes.map(res => (
                                    <option key={res._id} value={res._id}>
                                      Resume: {res.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {job.appliedResumeName && (
                                <div className="matched-resume-badge">
                                  <span>Selected: {job.appliedResumeName}</span>
                                </div>
                              )}

                              <div className="job-card-meta-list">
                                {job.url && (
                                  <a href={job.url} target="_blank" rel="noreferrer" className="job-meta-item link-item">
                                    🔗 Careers Site
                                  </a>
                                )}
                                {job.contactEmails && job.contactEmails.length > 0 ? (
                                  <span className="job-meta-item" title={job.contactEmails.join(', ')}>
                                    📧 {job.contactEmails.join(', ')}
                                  </span>
                                ) : job.contactEmail ? (
                                  <span className="job-meta-item">📧 {job.contactEmail}</span>
                                ) : null}
                                
                                {job.contactNumbers && job.contactNumbers.length > 0 ? (
                                  <span className="job-meta-item" title={job.contactNumbers.join(', ')}>
                                    📞 {job.contactNumbers.join(', ')}
                                  </span>
                                ) : job.contactNumber ? (
                                  <span className="job-meta-item">📞 {job.contactNumber}</span>
                                ) : null}
                              </div>

                              {job.url && (
                                <button
                                  type="button"
                                  className={`action-btn outline full-width deep-scrape-btn ${scrapingJobId === job._id ? 'scraping' : ''}`}
                                  onClick={() => handleDeepScrape(job._id)}
                                  disabled={scrapingJobId !== null}
                                  style={{ marginBottom: '0.75rem', gap: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  {scrapingJobId === job._id ? (
                                    <>
                                      <div className="spinner mini" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                                      <span>Scraping Recruiter Details...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>🔍 Deep Scrape / Analyse More</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Action Options Row */}
                              <div className="job-card-actions-wrapper">
                                <div className="outreach-details-toggle">
                                  {hasOutreach ? (
                                    <>
                                      <button
                                        type="button"
                                        className="action-btn outline small"
                                        onClick={() => toggleOutreachDetails(job._id)}
                                      >
                                        {isExpanded ? '🙈 Hide AI Pitch' : '👁️ Show AI Pitch'}
                                      </button>
                                      <button
                                        type="button"
                                        className="action-btn outline small"
                                        onClick={() => handleGenerateOutreach(job._id)}
                                        title="Force regenerate outreach using current selected resume"
                                      >
                                        🔄 Re-Draft
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="action-btn outline full-width"
                                      onClick={() => handleGenerateOutreach(job._id)}
                                    >
                                      ✍️ Pre-draft Outreach
                                    </button>
                                  )}
                                </div>

                                {hasOutreach && isExpanded && (
                                  <div className="ai-outreach-drawer">
                                    <div className="drawer-section">
                                      <div className="drawer-header-copy">
                                        <span className="ai-outreach-title">Email Outreach</span>
                                        <button 
                                          type="button" 
                                          className="copy-text-btn"
                                          onClick={() => handleCopyText(job.aiEmailBody, 'Email body')}
                                        >
                                          Copy
                                        </button>
                                      </div>
                                      <div className="ai-subject-box">
                                        <strong>Subject:</strong> {job.aiEmailSubject}
                                      </div>
                                      <div className="ai-template-box">{job.aiEmailBody}</div>
                                    </div>

                                    {job.aiWhatsAppMsg && (
                                      <div className="drawer-section">
                                        <div className="drawer-header-copy">
                                          <span className="ai-outreach-title">WhatsApp Outreach</span>
                                          <button 
                                            type="button" 
                                            className="copy-text-btn"
                                            onClick={() => handleCopyText(job.aiWhatsAppMsg, 'WhatsApp msg')}
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <div className="ai-template-box">{job.aiWhatsAppMsg}</div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="jobs-action-row">
                                  {/* Open Gmail button: dynamically generates from resume if not already generated */}
                                  <button
                                    type="button"
                                    className="action-btn primary"
                                    onClick={() => handleOpenGmailAndApply(job)}
                                    title="Clicking this reads your resume, drafts the email, and opens Gmail automatically."
                                  >
                                    📧 Open Gmail
                                  </button>
                                  
                                  <button
                                    type="button"
                                    className="action-btn secondary"
                                    onClick={() => handleSendWhatsAppAndApply(job)}
                                    title="Drafts and opens WhatsApp automatically."
                                  >
                                    💬 WhatsApp
                                  </button>

                                  <button
                                    type="button"
                                    className="action-btn outline"
                                    onClick={() => handleMarkApplied(job._id)}
                                  >
                                    ✓ Apply Manual
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Column 2: Manual Review */}
                  <div className="jobs-column">
                    <div className="column-header">
                      <div className="header-title-wrap">
                        <span className="column-icon">⚠️</span>
                        <h3>Manual Review</h3>
                      </div>
                      <span className="column-count">{manualJobs.length}</span>
                    </div>

                    <div className="jobs-card-list">
                      {manualJobs.length === 0 ? (
                        <div className="empty-column-box">
                          <p>Jobs requiring manual contact details will appear here.</p>
                        </div>
                      ) : (
                        manualJobs.map(job => {
                          const hasOutreach = job.aiEmailSubject && job.aiEmailBody;
                          const isExpanded = expandedOutreach[job._id];

                          return (
                            <div key={job._id} className="job-outreach-card manual-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                              <div className="job-card-header">
                                <div className="job-card-title">
                                  <h4>{job.title}</h4>
                                  <p className="company-tag">🏢 {job.company}</p>
                                </div>
                                <button
                                  type="button"
                                  className="job-delete-card-btn"
                                  onClick={(e) => handleDeleteJob(job._id, e)}
                                  title="Delete job"
                                >
                                  &times;
                                </button>
                              </div>

                              {job.description && (
                                <p className="job-card-desc">{job.description}</p>
                              )}

                              {/* Target Resume selector dropdown inside job card */}
                              <div className="job-card-resume-select">
                                <span className="select-icon">📄</span>
                                <select
                                  id={`resume-select-${job._id}`}
                                  value={jobResumes[job._id] !== undefined ? jobResumes[job._id] : (job.appliedResumeId || '')}
                                  onChange={(e) => handleSelectResumeForJob(job._id, e.target.value)}
                                >
                                  <option value="">Auto-Select best match (AI)</option>
                                  {profile.resumes && profile.resumes.map(res => (
                                    <option key={res._id} value={res._id}>
                                      Resume: {res.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {job.appliedResumeName && (
                                <div className="matched-resume-badge">
                                  <span>Selected: {job.appliedResumeName}</span>
                                </div>
                              )}

                              <div className="job-card-meta-list">
                                {job.url && (
                                  <a href={job.url} target="_blank" rel="noreferrer" className="job-meta-item link-item">
                                    🔗 Careers Site
                                  </a>
                                )}
                                {job.contactEmails && job.contactEmails.length > 0 ? (
                                  <span className="job-meta-item" title={job.contactEmails.join(', ')}>
                                    📧 {job.contactEmails.join(', ')}
                                  </span>
                                ) : job.contactEmail ? (
                                  <span className="job-meta-item">📧 {job.contactEmail}</span>
                                ) : null}
                                
                                {job.contactNumbers && job.contactNumbers.length > 0 ? (
                                  <span className="job-meta-item" title={job.contactNumbers.join(', ')}>
                                    📞 {job.contactNumbers.join(', ')}
                                  </span>
                                ) : job.contactNumber ? (
                                  <span className="job-meta-item">📞 {job.contactNumber}</span>
                                ) : null}
                              </div>

                              {job.url && (
                                <button
                                  type="button"
                                  className={`action-btn outline full-width deep-scrape-btn ${scrapingJobId === job._id ? 'scraping' : ''}`}
                                  onClick={() => handleDeepScrape(job._id)}
                                  disabled={scrapingJobId !== null}
                                  style={{ marginBottom: '0.75rem', gap: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  {scrapingJobId === job._id ? (
                                    <>
                                      <div className="spinner mini" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                                      <span>Scraping Recruiter Details...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>🔍 Deep Scrape / Analyse More</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Action Options Row */}
                              <div className="job-card-actions-wrapper">
                                <div className="outreach-details-toggle">
                                  {hasOutreach ? (
                                    <>
                                      <button
                                        type="button"
                                        className="action-btn outline small"
                                        onClick={() => toggleOutreachDetails(job._id)}
                                      >
                                        {isExpanded ? '🙈 Hide AI Pitch' : '👁️ Show AI Pitch'}
                                      </button>
                                      <button
                                        type="button"
                                        className="action-btn outline small"
                                        onClick={() => handleGenerateOutreach(job._id)}
                                        title="Force regenerate outreach using current selected resume"
                                      >
                                        🔄 Re-Draft
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="action-btn outline full-width"
                                      onClick={() => handleGenerateOutreach(job._id)}
                                    >
                                      ✍️ Pre-draft Outreach
                                    </button>
                                  )}
                                </div>

                                {hasOutreach && isExpanded && (
                                  <div className="ai-outreach-drawer">
                                    <div className="drawer-section">
                                      <div className="drawer-header-copy">
                                        <span className="ai-outreach-title">Email Outreach</span>
                                        <button 
                                          type="button" 
                                          className="copy-text-btn"
                                          onClick={() => handleCopyText(job.aiEmailBody, 'Email body')}
                                        >
                                          Copy
                                        </button>
                                      </div>
                                      <div className="ai-subject-box">
                                        <strong>Subject:</strong> {job.aiEmailSubject}
                                      </div>
                                      <div className="ai-template-box">{job.aiEmailBody}</div>
                                    </div>

                                    {job.aiWhatsAppMsg && (
                                      <div className="drawer-section">
                                        <div className="drawer-header-copy">
                                          <span className="ai-outreach-title">WhatsApp Outreach</span>
                                          <button 
                                            type="button" 
                                            className="copy-text-btn"
                                            onClick={() => handleCopyText(job.aiWhatsAppMsg, 'WhatsApp msg')}
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <div className="ai-template-box">{job.aiWhatsAppMsg}</div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="jobs-action-row">
                                  <button
                                    type="button"
                                    className="action-btn primary"
                                    onClick={() => handleOpenGmailAndApply(job)}
                                    title="Clicking this reads your resume, drafts the email, and opens Gmail automatically."
                                  >
                                    📧 Open Gmail
                                  </button>
                                  
                                  <button
                                    type="button"
                                    className="action-btn secondary"
                                    onClick={() => handleSendWhatsAppAndApply(job)}
                                    title="Drafts and opens WhatsApp automatically."
                                  >
                                    💬 WhatsApp
                                  </button>

                                  <button
                                    type="button"
                                    className="action-btn outline"
                                    onClick={() => handleMarkApplied(job._id)}
                                  >
                                    ✓ Apply Manual
                                  </button>
                                </div>

                                {/* Move back to To Apply column button */}
                                <button
                                  type="button"
                                  className="action-btn outline small move-to-apply-btn"
                                  onClick={() => handleMarkToApply(job._id)}
                                  title="Move back to To Apply column"
                                >
                                  ⏪ Move to To Apply
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Column 3: Already Applied */}
                  <div className="jobs-column">
                    <div className="column-header">
                      <div className="header-title-wrap">
                        <span className="column-icon">✅</span>
                        <h3>Already Applied</h3>
                      </div>
                      <span className="column-count">{appliedJobs.length}</span>
                    </div>

                    <div className="jobs-card-list">
                      {appliedJobs.length === 0 ? (
                        <div className="empty-column-box">
                          <p>Once you apply to jobs, they will appear here to help you track your submissions.</p>
                        </div>
                      ) : (
                        appliedJobs.map(job => (
                          <div key={job._id} className="job-outreach-card applied-card">
                            <div className="job-card-header">
                              <div className="job-card-title">
                                <h4>{job.title}</h4>
                                <p className="company-tag">🏢 {job.company}</p>
                              </div>
                              <button
                                type="button"
                                className="job-delete-card-btn"
                                onClick={(e) => handleDeleteJob(job._id, e)}
                              >
                                &times;
                              </button>
                            </div>

                            {job.appliedAt && (
                              <div className="applied-time">
                                🕒 Applied: {new Date(job.appliedAt).toLocaleDateString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            )}

                            {job.appliedResumeName && (
                              <div className="matched-resume-badge applied">
                                <span>📄 Resume used: {job.appliedResumeName}</span>
                              </div>
                            )}

                            <div className="job-card-meta-list">
                              <span className="job-meta-item applied-tag">Status: Applied</span>
                              {job.url && (
                                <a href={job.url} target="_blank" rel="noreferrer" className="job-meta-item link-item">
                                  🔗 Careers Site
                                </a>
                              )}
                              {job.contactEmails && job.contactEmails.length > 0 ? (
                                <span className="job-meta-item" title={job.contactEmails.join(', ')}>
                                  📧 {job.contactEmails.join(', ')}
                                </span>
                              ) : job.contactEmail ? (
                                <span className="job-meta-item">📧 {job.contactEmail}</span>
                              ) : null}
                              
                              {job.contactNumbers && job.contactNumbers.length > 0 ? (
                                <span className="job-meta-item" title={job.contactNumbers.join(', ')}>
                                  📞 {job.contactNumbers.join(', ')}
                                </span>
                              ) : job.contactNumber ? (
                                <span className="job-meta-item">📞 {job.contactNumber}</span>
                              ) : null}
                            </div>

                            {/* Move back to To Apply column button */}
                            <button
                              type="button"
                              className="action-btn outline small move-to-apply-btn"
                              onClick={() => handleMarkToApply(job._id)}
                              title="Move back to To Apply column"
                            >
                              ⏪ Move to To Apply
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ────────────────── Search Engine View ────────────────── */}
          {activeTab === 'search' && (
            <div className="search-view-container animate-fade-in">
              <div className="search-grid-layout">
                {/* Search Engine Form */}
                <div className="jobs-panel search-form-panel">
                  <div className="search-header-branding">
                    <span className="search-branding-icon">🚀</span>
                    <h3>Exa.ai Job Search & AI scraper</h3>
                  </div>
                  
                  <div className="search-tabs">
                    <button
                      className={`search-tab-btn ${searchTab === 'term' ? 'active' : ''}`}
                      onClick={() => setSearchTab('term')}
                    >
                      Find Jobs by Keywords
                    </button>
                    <button
                      className={`search-tab-btn ${searchTab === 'url' ? 'active' : ''}`}
                      onClick={() => setSearchTab('url')}
                    >
                      Scrape & Analyze Careers Link
                    </button>
                  </div>

                  {searchTab === 'term' ? (
                    <form onSubmit={handleTermSearch} className="search-input-form">
                      <div className="search-input-group">
                        <div className="input-wrapper">
                          <span className="input-icon">🔍</span>
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="e.g. React Developer Bangalore"
                            required
                          />
                        </div>
                        <button type="submit" className="search-submit-btn" disabled={searching}>
                          {searching ? 'Searching...' : 'Search Engine'}
                        </button>
                      </div>
                      <p className="search-tip">
                        Exa AI queries web indices specifically for careers and active application portals.
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={handleUrlSearch} className="search-input-form">
                      <div className="search-input-group">
                        <div className="input-wrapper">
                          <span className="input-icon">🔗</span>
                          <input
                            type="url"
                            value={searchUrl}
                            onChange={e => setSearchUrl(e.target.value)}
                            placeholder="Careers page URL (e.g. https://company.com/careers)"
                            required
                          />
                        </div>
                        <button type="submit" className="search-submit-btn" disabled={searching}>
                          {searching ? 'Analyzing...' : 'Analyze Page'}
                        </button>
                      </div>
                      <p className="search-tip">
                        Uses backend scraper to download HTML content (saving your Exa credits!) and leverages AI to parse details.
                      </p>
                    </form>
                  )}

                  {searching && (
                    <div className="loading-box">
                      <div className="spinner" />
                      <span>Exa search index running query...</span>
                    </div>
                  )}

                  {/* Exa Term Results */}
                  {searchTab === 'term' && termResults.length > 0 && (
                    <div className="exa-results-list-container">
                      <h4>Search Results ({termResults.length})</h4>
                      <div className="exa-results-list">
                        {termResults.map((res, i) => (
                          <div key={i} className="exa-result-card">
                            <a href={res.url} target="_blank" rel="noreferrer" className="exa-result-title">
                              {res.title || 'Job Opening'}
                            </a>
                            <div className="exa-result-meta">
                              <span>🌐 {res.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                              <button
                                type="button"
                                className="add-job-inline-btn"
                                onClick={() => handleAddJob(
                                  res.title || 'Software Developer',
                                  res.url.replace(/https?:\/\/(www\.)?/, '').split('.')[0],
                                  res.url,
                                  res.highlights?.join('\n') || ''
                                )}
                              >
                                + Import to Board
                              </button>
                            </div>
                            {res.highlights && res.highlights.length > 0 && (
                              <p className="exa-result-highlight">
                                "...{res.highlights[0]}..."
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scrape results */}
                  {searchTab === 'url' && scrapedDetails && (
                    <div className="scraped-details-card">
                      <div className="scraped-header">
                        <h4>🏢 {scrapedDetails.companyName}</h4>
                        <span className={`fresher-badge ${scrapedDetails.hiresFreshers?.toLowerCase()}`}>
                          Hires Freshers: {scrapedDetails.hiresFreshers}
                        </span>
                      </div>
                      
                      <div className="scraped-body">
                        <div className="scraped-item">
                          <span className="scraped-section-title">About Company</span>
                          <p>{scrapedDetails.aboutCompany}</p>
                        </div>

                        {scrapedDetails.fresherExplanation && (
                          <div className="scraped-item">
                            <span className="scraped-section-title">Eligibility Note</span>
                            <p>{scrapedDetails.fresherExplanation}</p>
                          </div>
                        )}

                        {scrapedDetails.availableJobs && scrapedDetails.availableJobs.length > 0 && (
                          <div className="scraped-item">
                            <span className="scraped-section-title">Detected Openings</span>
                            <div className="detected-roles-chips">
                              {scrapedDetails.availableJobs.map((role, idx) => (
                                <span key={idx} className="role-chip">{role}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {scrapedDetails.reviewsSummary && (
                          <div className="scraped-item">
                            <span className="scraped-section-title">Work Culture Reviews (Reddit / LinkedIn)</span>
                            <p className="culture-text">"{scrapedDetails.reviewsSummary}"</p>
                          </div>
                        )}

                        <div className="scraped-contact-row">
                          {scrapedDetails.contactEmail && (
                            <span>📧 Email: {scrapedDetails.contactEmail}</span>
                          )}
                          {scrapedDetails.contactPhone && (
                            <span>📞 Phone: {scrapedDetails.contactPhone}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="action-btn primary inline-btn"
                          onClick={() => handleAddJob(
                            scrapedDetails.availableJobs?.[0] || 'Software Developer',
                            scrapedDetails.companyName,
                            scrapedDetails.url,
                            scrapedDetails.aboutCompany,
                            scrapedDetails.contactEmail,
                            scrapedDetails.contactPhone,
                            scrapedDetails.contactEmails || [],
                            scrapedDetails.contactPhones || []
                          )}
                        >
                          📥 Import Company to Pipeline
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search History Sidebar Panel */}
                <div className="jobs-panel history-sidebar-panel">
                  <h3>🕒 Search History Log</h3>
                  {history.length === 0 ? (
                    <p className="empty-text">No search history recorded yet.</p>
                  ) : (
                    <div className="history-logs-list">
                      {history.map((h, i) => (
                        <div key={i} className={`history-log-item ${h.searchType}`}>
                          <div className="history-details">
                            <span className="history-log-text">{h.query}</span>
                            <span className="history-log-badge">
                              {h.searchType === 'term' ? 'Term' : 'URL Scrape'}
                            </span>
                          </div>
                          <span className="history-log-time">
                            {new Date(h.createdAt).toLocaleDateString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── Profile & Resumes View ────────────────── */}
          {activeTab === 'profile' && (
            <div className="profile-view-container animate-fade-in">
              <div className="profile-grid-layout">
                {/* General Preferences Panel */}
                <div className="jobs-panel profile-form-panel">
                  <h3>👤 General Profile Preferences</h3>
                  <form onSubmit={handleSaveConfig} className="config-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={profile.userName}
                          onChange={e => setProfile({ ...profile, userName: e.target.value })}
                          placeholder="Your Name"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Email Address</label>
                        <input
                          type="email"
                          value={profile.userEmail}
                          onChange={e => setProfile({ ...profile, userEmail: e.target.value })}
                          placeholder="you@gmail.com"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>WhatsApp Outbox Phone</label>
                        <input
                          type="text"
                          value={profile.userPhone}
                          onChange={e => setProfile({ ...profile, userPhone: e.target.value })}
                          placeholder="+91..."
                        />
                      </div>

                      <div className="form-group">
                        <label>Experience Level</label>
                        <select
                          value={profile.experienceLevel}
                          onChange={e => setProfile({ ...profile, experienceLevel: e.target.value })}
                        >
                          <option value="fresher">🎓 Fresher / Graduate</option>
                          <option value="experienced">💼 Experienced Professional</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Target Roles (comma separated)</label>
                      <input
                        type="text"
                        value={profile.targetRoles}
                        onChange={e => setProfile({ ...profile, targetRoles: e.target.value })}
                        placeholder="React Developer, Node Backend, SDE-1"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Target Locations</label>
                      <input
                        type="text"
                        value={profile.targetLocation}
                        onChange={e => setProfile({ ...profile, targetLocation: e.target.value })}
                        placeholder="Bangalore, remote, etc."
                      />
                    </div>

                    <div className="form-group">
                      <label>Default Bio / Fallback Summary (used if no resumes match)</label>
                      <textarea
                        value={profile.resumeText}
                        onChange={e => setProfile({ ...profile, resumeText: e.target.value })}
                        placeholder="List your key tech stack, projects, college, cgpa, or prior internships..."
                        rows={4}
                      />
                    </div>

                    <div className="form-group">
                      <label>Exa.ai API Key</label>
                      <input
                        type="password"
                        value={profile.exaApiKey}
                        onChange={e => setProfile({ ...profile, exaApiKey: e.target.value })}
                        placeholder="exa-..."
                      />
                      <small className="help-text">Required for web search functionality.</small>
                    </div>

                    <button type="submit" className="search-submit-btn" disabled={savingConfig}>
                      {savingConfig ? 'Saving Configurations...' : '💾 Save General Details'}
                    </button>
                  </form>
                </div>

                {/* PDF Resume Bank Manager */}
                <div className="jobs-panel resume-bank-panel">
                  <div className="resume-bank-header">
                    <h3>📄 PDF Resume Bank Manager</h3>
                    <span className="resume-count">
                      {profile.resumes?.length || 0} / 6 Resumes
                    </span>
                  </div>
                  
                  <p className="resume-bank-desc">
                    Upload up to 6 distinct PDF or TXT resumes. AI will parse each file's text, extract summaries & skills, and automatically pick the best resume to generate outreach drafts based on job openings!
                  </p>

                  {/* Uploader UI Box */}
                  <div className="resume-uploader-box">
                    <label className="uploader-drop-area">
                      <input
                        type="file"
                        accept=".pdf,.txt"
                        onChange={handleResumeUpload}
                        disabled={uploadingResume || (profile.resumes && profile.resumes.length >= 6)}
                        style={{ display: 'none' }}
                      />
                      <span className="uploader-icon">📤</span>
                      <span className="uploader-text">
                        {uploadingResume ? 'Parsing PDF text...' : 'Click to Upload Resume (PDF / TXT)'}
                      </span>
                      <span className="uploader-subtext">Max size: 5MB</span>
                    </label>
                  </div>

                  {uploadingResume && (
                    <div className="resume-spinner-box">
                      <div className="spinner" />
                      <span>Gemini AI is parsing details, extracting summaries & skills...</span>
                    </div>
                  )}

                  {/* List of resumes */}
                  <div className="resumes-list">
                    {!profile.resumes || profile.resumes.length === 0 ? (
                      <p className="empty-text">No resumes uploaded yet. Upload a resume to enable resume auto-matching.</p>
                    ) : (
                      profile.resumes.map(resume => (
                        <div key={resume._id} className="resume-card">
                          <div className="resume-card-header">
                            <span className="resume-name-text">📄 {resume.name}</span>
                            <button
                              type="button"
                              className="delete-resume-btn"
                              onClick={() => handleDeleteResume(resume._id)}
                              title="Delete resume"
                            >
                              Delete
                            </button>
                          </div>
                          
                          <div className="resume-skills-chips">
                            {resume.skills && resume.skills.map((skill, sIdx) => (
                              <span key={sIdx} className="skill-tag">{skill}</span>
                            ))}
                          </div>

                          <div className="resume-summary-box">
                            <p>{resume.summary}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── Automation Scheduler View ────────────────── */}
          {activeTab === 'scheduler' && (
            <div className="scheduler-view-container animate-fade-in">
              <div className="scheduler-grid-layout">
                {/* Active Automated Tasks list */}
                <div className="jobs-panel tasks-list-panel">
                  <h3>🤖 Active Daily Automation Tasks</h3>
                  <p className="tasks-desc">
                    These automated cron jobs run daily at the scheduled local time (Asia/Kolkata timezone) to perform background activities.
                  </p>

                  {loadingTasks ? (
                    <div className="loading-box">
                      <div className="spinner" />
                      <span>Fetching task configurations...</span>
                    </div>
                  ) : tasks.length === 0 ? (
                    <p className="empty-text">No automated tasks scheduled yet. Create one on the right!</p>
                  ) : (
                    <div className="tasks-list">
                      {tasks.map(task => (
                        <div key={task._id} className={`task-card ${task.isActive ? 'active' : 'inactive'}`}>
                          <div className="task-card-main">
                            <div className="task-type-badge-wrap">
                              <span className="task-icon">
                                {task.type === 'apply' && '📧'}
                                {task.type === 'message' && '💬'}
                                {task.type === 'search' && '🔍'}
                              </span>
                              <div className="task-meta-details">
                                <span className="task-type-label">
                                  {task.type === 'apply' && 'Auto Outreach / Apply'}
                                  {task.type === 'message' && 'WhatsApp Broadcast'}
                                  {task.type === 'search' && 'Exa Auto-Search'}
                                </span>
                                <span className="task-schedule-time">🕒 Daily at {task.time}</span>
                              </div>
                            </div>

                            <div className="task-action-toggle">
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={task.isActive}
                                  onChange={() => handleToggleTask(task._id)}
                                />
                                <span className="slider round"></span>
                              </label>
                              
                              <button
                                type="button"
                                className="delete-task-btn"
                                onClick={() => handleDeleteTask(task._id)}
                                title="Delete task"
                              >
                                &times;
                              </button>
                            </div>
                          </div>

                          {/* Task configuration details */}
                          <div className="task-config-preview">
                            {task.type === 'search' && (
                              <p><strong>Query:</strong> "{task.data?.query}"</p>
                            )}
                            {task.type === 'message' && (
                              <>
                                <p><strong>Send To:</strong> {task.data?.phone}</p>
                                <p className="msg-preview"><strong>Text:</strong> "{task.data?.messageText}"</p>
                              </>
                            )}
                            {task.type === 'apply' && (
                              <p>Auto-drafts email outreach using best resumes and updates pipelines in background.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Scheduled Task Form */}
                <div className="jobs-panel create-task-panel">
                  <h3>➕ Add Automation Task</h3>
                  <form onSubmit={handleCreateTask} className="task-form">
                    <div className="form-group">
                      <label>Task Type</label>
                      <select value={taskType} onChange={e => setTaskType(e.target.value)}>
                        <option value="apply">📧 Auto-Outreach (Generate email template & update board)</option>
                        <option value="message">💬 Send WhatsApp Message broadcast</option>
                        <option value="search">🔍 Exa Auto-Search & Import (Exa query scheduler)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Schedule Daily Time (HH:MM)</label>
                      <input
                        type="time"
                        value={taskTime}
                        onChange={e => setTaskTime(e.target.value)}
                        required
                      />
                    </div>

                    {/* Conditional input fields based on Task Type */}
                    {taskType === 'search' && (
                      <div className="form-group conditional-group animate-slide-up">
                        <label>Search Query for Exa</label>
                        <input
                          type="text"
                          value={taskQuery}
                          onChange={e => setTaskQuery(e.target.value)}
                          placeholder="e.g. React Developer Bengaluru fresher jobs"
                          required
                        />
                        <span className="help-text">Runs auto-search at scheduled time and imports jobs to pipeline.</span>
                      </div>
                    )}

                    {taskType === 'message' && (
                      <div className="conditional-group animate-slide-up">
                        <div className="form-group">
                          <label>Recipient WhatsApp Number (with country code)</label>
                          <input
                            type="text"
                            value={taskPhone}
                            onChange={e => setTaskPhone(e.target.value)}
                            placeholder="e.g. +91XXXXXXXXXX"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Message Content</label>
                          <textarea
                            value={taskMessage}
                            onChange={e => setTaskMessage(e.target.value)}
                            placeholder="Hello, I am interested in exploring opportunities..."
                            rows={4}
                            required
                          />
                        </div>
                      </div>
                    )}

                    {taskType === 'apply' && (
                      <div className="form-group info-group animate-slide-up">
                        <p className="scheduler-info-note">
                          ℹ️ Every day at the scheduled time, the system will select all active "To Apply" jobs, auto-match them against your parsed resumes, and write AI-tailored outreach drafts.
                        </p>
                      </div>
                    )}

                    <button type="submit" className="search-submit-btn" disabled={creatingTask}>
                      {creatingTask ? 'Scheduling...' : '⏰ Schedule Daily Task'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── Manual Outreach Composer View ────────────────── */}
          {activeTab === 'manual' && (
            <div className="manual-view-container animate-fade-in">
              <div className="manual-grid-layout">
                {/* Input Details Form */}
                <div className="jobs-panel manual-form-panel">
                  <h3>📧 Generate Custom Outreach Draft</h3>
                  <p className="manual-desc">
                    Need to send outreach for a job opening not in your tracker? Input details below and select a resume. AI will compile custom subject, email, and WhatsApp templates.
                  </p>

                  <form onSubmit={handleManualDraftSubmit} className="config-form">
                    <div className="form-group">
                      <label>Job Title</label>
                      <input
                        type="text"
                        value={manualJobTitle}
                        onChange={e => setManualJobTitle(e.target.value)}
                        placeholder="e.g. Frontend Engineer"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Company Name</label>
                      <input
                        type="text"
                        value={manualCompany}
                        onChange={e => setManualCompany(e.target.value)}
                        placeholder="e.g. Google"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Select Target Resume Profile</label>
                      <select value={manualResumeId} onChange={e => setManualResumeId(e.target.value)}>
                        <option value="">No Resume Profile (Use default bio details)</option>
                        {profile.resumes && profile.resumes.map(resume => (
                          <option key={resume._id} value={resume._id}>
                            📄 {resume.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Job Description / Skills required (Optional)</label>
                      <textarea
                        value={manualJobDesc}
                        onChange={e => setManualJobDesc(e.target.value)}
                        placeholder="Paste job description text here to align summaries and match skills..."
                        rows={6}
                      />
                    </div>

                    <button type="submit" className="search-submit-btn" disabled={generatingManual}>
                      {generatingManual ? 'Generating Custom Draft...' : '🪄 Generate Outreach Draft'}
                    </button>
                  </form>
                </div>

                {/* Generated Output panel */}
                <div className="jobs-panel manual-output-panel">
                  <h3>📄 Custom AI Outreach Draft</h3>
                  
                  {generatingManual && (
                    <div className="loading-box">
                      <div className="spinner" />
                      <span>Writing custom email outreach templates...</span>
                    </div>
                  )}

                  {!generatingManual && !manualOutreach && (
                    <div className="empty-output-box">
                      <span className="output-icon">📝</span>
                      <p>Fill out the job parameters on the left to write recruiter email and WhatsApp outreach templates automatically.</p>
                    </div>
                  )}

                  {!generatingManual && manualOutreach && (
                    <div className="manual-outreach-output-box animate-slide-up">
                      <div className="output-section">
                        <div className="output-section-header">
                          <span className="output-title">📧 Recruiter Email Subject</span>
                          <button
                            type="button"
                            className="copy-btn-link"
                            onClick={() => handleCopyText(manualOutreach.emailSubject, 'Subject')}
                          >
                            Copy
                          </button>
                        </div>
                        <div className="output-content-box strong">
                          {manualOutreach.emailSubject}
                        </div>
                      </div>

                      <div className="output-section">
                        <div className="output-section-header">
                          <span className="output-title">📝 Email Body</span>
                          <button
                            type="button"
                            className="copy-btn-link"
                            onClick={() => handleCopyText(manualOutreach.emailBody, 'Email body')}
                          >
                            Copy Email
                          </button>
                        </div>
                        <div className="output-content-box scroll">
                          {manualOutreach.emailBody}
                        </div>
                      </div>

                      {manualOutreach.whatsAppMsg && (
                        <div className="output-section">
                          <div className="output-section-header">
                            <span className="output-title">💬 WhatsApp Message</span>
                            <button
                              type="button"
                              className="copy-btn-link"
                              onClick={() => handleCopyText(manualOutreach.whatsAppMsg, 'WhatsApp msg')}
                            >
                              Copy Message
                            </button>
                          </div>
                          <div className="output-content-box scroll">
                            {manualOutreach.whatsAppMsg}
                          </div>
                        </div>
                      )}

                      <div className="output-action-buttons">
                        <a
                          href={getManualGmailLink()}
                          target="_blank"
                          rel="noreferrer"
                          className="action-btn primary"
                        >
                          📧 Open in Gmail
                        </a>
                        {manualOutreach.whatsAppMsg && (
                          <a
                            href={getManualWhatsAppLink()}
                            target="_blank"
                            rel="noreferrer"
                            className="action-btn secondary"
                          >
                            💬 Send via WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <SuccessNotification
        message={successMsg}
        isVisible={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
    </div>
  );
};

export default JobsPage;
