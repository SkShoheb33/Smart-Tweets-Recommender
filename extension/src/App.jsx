import React, { useState, useEffect } from 'react';
import TweetCard from './TweetCard';
import { RefreshCw, Bot, X, CircleCheck, CircleAlert, Settings, Key } from 'lucide-react';

const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTopic, setActiveTopic] = useState('All');
  const [agentStatus, setAgentStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Utility function to safely check if extension is still valid
  const isExtensionValid = () => {
    try {
      return !!chrome.runtime?.id;
    } catch (e) {
      return false;
    }
  };

  // Poll server status
  useEffect(() => {
    const checkServer = () => {
      if (!isExtensionValid()) return;
      
      try {
        chrome.runtime.sendMessage({ action: 'check_server' }, (response) => {
          if (chrome.runtime.lastError) return;
          
          if (response && response.online) {
            setServerOnline(true);
          } else {
            setServerOnline(false);
          }
        });
      } catch (e) {
        // Silently catch context invalidated errors
      }
    };
    
    checkServer();
    const intervalId = setInterval(checkServer, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Listen for SSE messages from background script
  useEffect(() => {
    if (!isExtensionValid()) return;

    const handleMessage = (message) => {
      if (message.type === 'AGENT_STATUS') {
        setAgentStatus(message.status);
      } else if (message.type === 'AGENT_DONE') {
        setLoading(false);
        setAgentStatus('');
        if (message.data && message.data.recommendations) {
          setRecommendations(message.data.recommendations);
          setUserProfile(message.data.user_profile);
          
          const now = Date.now();
          setLastUpdated(now);
          
          try {
            if (isExtensionValid()) {
              chrome.storage.local.set({
                savedRecommendations: message.data.recommendations,
                savedUserProfile: message.data.user_profile,
                lastUpdatedTime: now
              });
            }
          } catch (e) {
            // Silently fail
          }
        }
      } else if (message.type === 'AGENT_ERROR') {
        setLoading(false);
        setAgentStatus('');
        setError(message.error === 'Failed to fetch' ? 'Server not running' : message.error);
      }
    };

    try {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => {
        try {
          if (isExtensionValid()) {
            chrome.runtime.onMessage.removeListener(handleMessage);
          }
        } catch (e) {
          // Silently fail
        }
      };
    } catch (e) {
      // Silently fail
    }
  }, []);

  // Load saved recommendations and settings from storage on mount
  useEffect(() => {
    try {
      if (isExtensionValid()) {
        chrome.storage.local.get(['savedRecommendations', 'savedUserProfile', 'lastUpdatedTime', 'googleApiKey'], (result) => {
          if (chrome.runtime.lastError) return;
          if (result.savedRecommendations) {
            setRecommendations(result.savedRecommendations);
          }
          if (result.savedUserProfile) {
            setUserProfile(result.savedUserProfile);
          }
          if (result.lastUpdatedTime) {
            setLastUpdated(result.lastUpdatedTime);
          }
          if (result.googleApiKey) {
            setGoogleApiKey(result.googleApiKey);
          } else {
            setShowSettings(true);
          }
        });
      }
    } catch (e) {
      // Silently fail
    }
  }, []);

  const saveApiKey = (key) => {
    setGoogleApiKey(key);
    try {
      if (isExtensionValid()) {
        chrome.storage.local.set({ googleApiKey: key });
      }
    } catch (e) {
      // Silently fail
    }
    if (key) setShowSettings(false);
  };

  // 2. Fetch recommendations
  const fetchRecommendations = () => {
    if (!googleApiKey) {
      setShowSettings(true);
      return;
    }
    
    setLoading(true);
    setError(null);
    setAgentStatus('Starting agent...');
    
    try {
      if (isExtensionValid()) {
        chrome.runtime.sendMessage({ 
          action: 'fetch_recommendations',
          googleApiKey: googleApiKey 
        });
      } else {
        setError('Extension updated. Please refresh the page (F5) to use the new version.');
        setLoading(false);
      }
    } catch (e) {
      setError('Extension updated. Please refresh the page (F5) to use the new version.');
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */ }
      <button
        onClick={ () => setIsSidebarOpen(true) }
        className="fixed top-0 right-0 z-[2147483647] bg-[#1d9bf0] text-white p-2 m-4 rounded-full shadow-[0_4px_16px_rgba(29,155,240,0.5)] hover:bg-[#1a8cd8] hover:scale-105 transition-all duration-200 flex items-center justify-center group cursor-pointer border-none"
        title="Open Twitter Agent"
      >
        <Bot className="w-7 h-7" />
        <span className="absolute right-0 mr-3 bg-[rgba(0,0,0,0.8)] text-white text-sm px-3 py-1.5 rounded-md font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Agent Feed
        </span>
      </button>

      {/* Sidebar Overlay (Darkens background slightly) */ }
      { isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[2147483646] backdrop-blur-sm transition-opacity"
          onClick={ () => setIsSidebarOpen(false) }
        />
      ) }

      {/* Profile Persona Panel (Left empty space center) */ }
      { isSidebarOpen && (
        <div className="fixed top-full left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-4 z-[2147483647]">

          {/* Status Panel */ }
          <div className="w-[640px] bg-[#000000] border border-[rgb(47,51,54)] rounded-2xl p-5 shadow-2xl">
            <h3 className="text-[#e7e9ea] font-bold text-md mb-3 m-0">System Status</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[#71767b] text-sm flex items-center gap-2">Server: { serverOnline ? <span className="text-[#00ba7c] flex items-center gap-2"><CircleCheck className="w-4 h-4 text-[#00ba7c]" /> Online</span> : <span className="text-[#f4212e] flex items-center gap-2"><CircleAlert className="w-4 h-4 text-[#f4212e]" /> Offline</span> }</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#71767b] text-sm">
                  { loading
                    ? `Agent: ${agentStatus || 'Running...'}`
                    : `Last Update: ${lastUpdated ? new Date(lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* User Persona Panel */ }
          { userProfile && (
            <div className="w-[640px] bg-[#000000] border border-[rgb(47,51,54)] rounded-2xl p-6 shadow-2xl">
              <h3 className="text-[#1d9bf0] font-bold text-lg mb-5 flex items-center gap-2 m-0">
                <Bot className="w-5 h-5" /> User Persona
              </h3>

              <div className="mb-5">
                <h4 className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2.5 m-0">Interests</h4>
                <div className="flex flex-wrap gap-2">
                  { userProfile.interests?.map((interest, i) => (
                    <span key={ i } className="bg-[rgba(29,155,240,0.1)] text-[#1d9bf0] text-xs px-2.5 py-1.5 rounded-md border border-[#1d9bf0]/20">
                      { interest }
                    </span>
                  )) }
                </div>
              </div>

              <div className="mb-5">
                <h4 className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2.5 m-0">Preferred Topics</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={ () => setActiveTopic('All') }
                    className={ `text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${activeTopic === 'All' ? 'bg-[#1d9bf0] text-white border-[#1d9bf0]' : 'bg-[rgba(255,255,255,0.05)] text-[#e7e9ea] border-[rgb(47,51,54)] hover:bg-[rgba(255,255,255,0.1)]'}` }
                  >
                    All
                  </button>
                  { userProfile.preferred_topics?.map((topic, i) => (
                    <button
                      key={ i }
                      onClick={ () => setActiveTopic(topic) }
                      className={ `text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${activeTopic === topic ? 'bg-[#1d9bf0] text-white border-[#1d9bf0]' : 'bg-[rgba(255,255,255,0.05)] text-[#e7e9ea] border-[rgb(47,51,54)] hover:bg-[rgba(255,255,255,0.1)]'}` }
                    >
                      { topic }
                    </button>
                  )) }
                </div>
              </div>

              <div>
                <h4 className="text-[#71767b] text-xs font-bold uppercase tracking-wider mb-2.5 m-0">Tone</h4>
                <p className="text-[#e7e9ea] text-sm m-0 leading-relaxed italic">
                  "{ userProfile.tone }"
                </p>
              </div>
            </div>
          ) }
        </div>
      ) }

      {/* Sliding Sidebar */ }
      <div
        className={ `fixed top-0 right-0 h-screen w-[420px] bg-[#000000] border-l border-[rgb(47,51,54)] z-[2147483647] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}` }
      >
        <div className="flex flex-col h-full">
          {/* Header */ }
          <div className="sticky top-0 bg-[rgba(0,0,0,0.85)] backdrop-blur-md border-b border-[rgb(47,51,54)] p-4 flex justify-between items-center z-10">
            <h2 className="text-[#e7e9ea] font-bold text-xl flex items-center gap-2 m-0">
              <Bot className="w-6 h-6 text-[#1d9bf0]" />
              Agent Recommendations
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={ () => setShowSettings(!showSettings) }
                className={`text-[#71767b] hover:text-[#e7e9ea] hover:bg-[rgba(255,255,255,0.1)] p-2 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center ${showSettings ? 'text-[#1d9bf0] bg-[rgba(29,155,240,0.1)]' : ''}`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={ () => setIsSidebarOpen(false) }
                className="text-[#71767b] hover:text-[#e7e9ea] hover:bg-[rgba(255,255,255,0.1)] p-2 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="px-4 py-4 border-b border-[rgb(47,51,54)] bg-[rgba(29,155,240,0.02)] shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[#1d9bf0]">
                  <Key className="w-4 h-4" />
                  <span className="font-bold text-[14px]">Google API Key</span>
                </div>
                <p className="text-[13px] text-[#71767b] m-0">
                  Required to run the Gemini agent. Your key is stored securely in your browser's local storage.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="AIzaSy..."
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    className="flex-1 bg-black border border-[rgb(47,51,54)] rounded-md px-3 py-2 text-[14px] text-[#e7e9ea] focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0]"
                  />
                  <button 
                    onClick={() => saveApiKey(googleApiKey)}
                    className="bg-[#e7e9ea] hover:bg-[#d7dbdc] text-black px-4 py-2 rounded-md font-bold text-[14px] transition-colors border-none cursor-pointer whitespace-nowrap"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */ }
          <div className="px-4 py-3 border-b border-[rgb(47,51,54)] flex justify-between items-center bg-[rgba(255,255,255,0.02)] shrink-0">
            <div className="flex flex-col">
              <span className="text-[#71767b] text-[14px]">Your personalized feed</span>
            </div>
            <button
              onClick={ fetchRecommendations }
              disabled={ loading }
              className="flex items-center gap-2 bg-[#e7e9ea] hover:bg-[#d7dbdc] text-black px-4 py-1.5 rounded-full font-bold text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm"
            >
              <RefreshCw className={ `w-4 h-4 ${loading ? 'animate-spin' : ''}` } />
              { loading ? 'Running...' : 'Run Agent' }
            </button>
          </div>

          {/* Feed Content */ }
          <div className="flex-1 overflow-y-auto">
            { loading && (
              <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 animate-spin text-[#1d9bf0]" />
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[#e7e9ea]">Agent is running...</span>
                  <span className="text-[14px] text-[#1d9bf0]">{ agentStatus || 'Initializing...' }</span>
                </div>
              </div>
            ) }

            { error && (
              <div className="p-6 text-center text-[#f4212e] bg-[rgba(244,33,46,0.1)] m-4 rounded-xl border border-[#f4212e]/20">
                <p className="font-bold mb-2 m-0">Agent Error</p>
                <p className="m-0 text-[14px]">{ error }</p>
                { error === 'Server not running' && (
                  <p className="mt-3 text-sm text-[#e7e9ea] m-0">Make sure you run <code className="bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded font-mono">python server.py</code> in the project root.</p>
                ) }
              </div>
            ) }

            { !loading && !error && recommendations.length === 0 && (
              <div className="p-8 text-center text-[#71767b] flex flex-col items-center gap-3">
                <Bot className="w-12 h-12 text-[#71767b]/50" />
                <span>No recommendations found.<br />Click "Run Agent" to start analyzing.</span>
              </div>
            ) }

            { !loading && recommendations.length > 0 && (
              <div className="flex flex-col pb-6">
                {/* Profile Persona moved to left side of sidebar */ }
                <div className="mt-2">
                  { recommendations.filter(rec => activeTopic === 'All' || rec.topic === activeTopic).map((rec, index) => (
                    <TweetCard key={ index } rec={ rec } />
                  )) }

                  { recommendations.filter(rec => activeTopic === 'All' || rec.topic === activeTopic).length === 0 && (
                    <div className="p-8 text-center text-[#71767b]">
                      No recommendations match this topic.
                    </div>
                  ) }
                </div>
              </div>
            ) }
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
