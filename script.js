(function() {
  'use strict';
  
  // DOM Elements
  const totalMins = document.getElementById('totalMins');
  const qMins = document.getElementById('qMins');
  const beepMs = document.getElementById('beepMs');
  const qClock = document.getElementById('qClock');
  const tClock = document.getElementById('tClock');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const skipBtn = document.getElementById('skipBtn');
  const muteBtn = document.getElementById('muteBtn');
  const qNumber = document.getElementById('qNumber');
  const qProgress = document.getElementById('qProgress');
  const tProgress = document.getElementById('tProgress');
  const sessionStats = document.getElementById('sessionStats');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');

  // State
  let totalSeconds = 60 * parseFloat(totalMins.value || 60);
  let perQuestion = Math.max(30, Math.round(parseFloat(qMins.value || 2) * 60));
  let remainingTotal = totalSeconds;
  let remainingQuestion = perQuestion;
  let qCount = 1;
  let running = false;
  let timerId = null;
  let muted = false;
  let audioCtx = null;
  let originalTotalSeconds = totalSeconds;
  let originalPerQuestion = perQuestion;

  // Initialize Audio Context
  function initAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Audio context not supported:', e);
        muted = true;
        muteBtn.innerHTML = '<span class="btn-icon">🔇</span> Audio N/A';
        muteBtn.disabled = true;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {
        muted = true;
        muteBtn.innerHTML = '<span class="btn-icon">🔇</span> Audio N/A';
      });
    }
  }

  // Sound functions
  function beep(ms) {
    if (muted || !audioCtx) return;
    try {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms/1000);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + ms/1000);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  function playEndSound() {
    if (muted || !audioCtx) return;
    try {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Format time as MM:SS
  function formatTime(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Update all displays
  function updateDisplays() {
    qClock.textContent = formatTime(remainingQuestion);
    tClock.textContent = formatTime(remainingTotal);
    qNumber.textContent = qCount;
    
    // Calculate progress based on ORIGINAL values to prevent bar jumps
    const currentTotalElapsed = originalTotalSeconds - remainingTotal;
    const currentQuestionElapsed = originalPerQuestion - remainingQuestion;
    
    const qPct = Math.min(100, Math.max(0, (currentQuestionElapsed / originalPerQuestion) * 100));
    const tPct = Math.min(100, Math.max(0, (currentTotalElapsed / originalTotalSeconds) * 100));
    
    // Update progress ring for question timer
    const circumference = 2 * Math.PI * 130;
    const offset = circumference - (qPct / 100) * circumference;
    qProgress.style.strokeDashoffset = offset;
    
    // Update progress bar for total timer
    tProgress.style.width = `${tPct}%`;
    
    // Update session stats
    sessionStats.textContent = `Question: ${(perQuestion/60).toFixed(1)}m • Total: ${(totalSeconds/60).toFixed(1)}m`;
    
    // Update status
    if (running) {
      statusDot.className = 'status-dot active';
      statusText.textContent = 'Timer running';
    } else if (remainingTotal <= 0) {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Completed';
    } else {
      statusDot.className = 'status-dot paused';
      statusText.textContent = 'Paused';
    }
  }

  // Sync values from inputs
  function syncValues() {
    const newTotalSeconds = Math.max(60, Math.round(60 * parseFloat(totalMins.value || 60)));
    const newPerQuestion = Math.max(30, Math.round(60 * parseFloat(qMins.value || 2)));
    
    if (!running) {
      // Only update original values when not running to prevent progress bar jumps
      originalTotalSeconds = newTotalSeconds;
      originalPerQuestion = newPerQuestion;
      totalSeconds = newTotalSeconds;
      perQuestion = newPerQuestion;
      remainingTotal = totalSeconds;
      remainingQuestion = perQuestion;
      qCount = 1;
    } else {
      // When running, only update current timing values, keep original for progress calculation
      totalSeconds = newTotalSeconds;
      perQuestion = newPerQuestion;
      remainingTotal = Math.min(remainingTotal, totalSeconds);
      remainingQuestion = Math.min(remainingQuestion, perQuestion);
    }
    
    updateDisplays();
  }

  // Timer functions
  function tick() {
    if (remainingTotal <= 0) {
      stop(true);
      return;
    }
    
    remainingTotal -= 1;
    remainingQuestion -= 1;
    
    if (remainingQuestion <= 0) {
      beep(Math.max(10, Math.min(1000, parseInt(beepMs.value || 120))));
      qCount += 1;
      remainingQuestion = Math.min(perQuestion, remainingTotal);
      
      if (remainingTotal <= 0) {
        stop(true);
        return;
      }
    }
    
    updateDisplays();
  }

  function start() {
    if (running) return;
    
    initAudio();
    if (remainingTotal <= 0) {
      // Reset original values when starting fresh
      originalTotalSeconds = totalSeconds;
      originalPerQuestion = perQuestion;
      syncValues();
    }
    
    running = true;
    timerId = setInterval(tick, 1000);
    
    startBtn.innerHTML = '<span class="btn-icon">⏸</span> Running';
    startBtn.disabled = true;
    
    updateDisplays();
  }

  function pause() {
    if (!running) return;
    
    clearInterval(timerId);
    timerId = null;
    running = false;
    
    startBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
    startBtn.disabled = false;
    
    updateDisplays();
  }

  function stop(playEnd = false) {
    pause();
    
    if (playEnd && !muted) {
      playEndSound();
      qClock.classList.add('timer-alert');
      setTimeout(() => qClock.classList.remove('timer-alert'), 1500);
    }
    
    remainingTotal = 0;
    remainingQuestion = 0;
    updateDisplays();
  }

  function reset() {
    pause();
    // Reset both current and original values
    originalTotalSeconds = 60 * parseFloat(totalMins.value || 60);
    originalPerQuestion = Math.max(30, Math.round(60 * parseFloat(qMins.value || 2)));
    syncValues();
    startBtn.innerHTML = '<span class="btn-icon">▶</span> Start';
    startBtn.disabled = false;
  }

  // Event listeners
  totalMins.addEventListener('change', syncValues);
  qMins.addEventListener('change', syncValues);
  beepMs.addEventListener('change', syncValues);
  
  // Prevent input from affecting progress bars while running
  totalMins.addEventListener('input', function() {
    if (!running) {
      syncValues();
    }
  });
  
  qMins.addEventListener('input', function() {
    if (!running) {
      syncValues();
    }
  });
  
  // Button event listeners
  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', pause);
  resetBtn.addEventListener('click', reset);
  
  skipBtn.addEventListener('click', () => {
    if (remainingTotal <= 0 || !running) return;
    
    beep(Math.max(10, Math.min(1000, parseInt(beepMs.value || 120))));
    qCount += 1;
    remainingQuestion = Math.min(perQuestion, remainingTotal);
    updateDisplays();
  });
  
  muteBtn.addEventListener('click', () => { 
    muted = !muted; 
    muteBtn.innerHTML = muted ? 
      '<span class="btn-icon">🔇</span> Unmute' : 
      '<span class="btn-icon">🔊</span> Mute';
    
    // Initialize audio on first unmute
    if (!muted) initAudio();
  });

  // Settings panel
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.add('active');
  });

  settingsClose.addEventListener('click', () => {
    settingsPanel.classList.remove('active');
  });

  // Touch event improvements for mobile
  document.addEventListener('touchstart', function() {}, {passive: true});
  
  // Prevent double-tap zoom
  document.addEventListener('touchend', function(e) {
    if (e.target.tagName === 'BUTTON') {
      e.preventDefault();
    }
  }, {passive: false});

  // Initialize
  syncValues();
  updateDisplays();
  
  // Add subtle feedback to buttons
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('touchstart', function() {
      this.style.transform = 'scale(0.98)';
    });
    
    btn.addEventListener('touchend', function() {
      this.style.transform = '';
    });
  });
})();
