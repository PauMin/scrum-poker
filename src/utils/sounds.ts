const getAudioContext = (): AudioContext | null => {
  if (typeof window !== 'undefined') {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
         // We use a singleton pattern or just new instance?
         // Browsers limit contexts, so singleton is better, but dealing with strict mode/resuming is tricky.
         // For this simple app, let's try to store it globally on module scope, initialized on first call.
         if (!(window as any).__audioContext__) {
             (window as any).__audioContext__ = new Ctx();
         }
         return (window as any).__audioContext__;
    }
  }
  return null;
};

const playSound = (type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'whitenoise', frequency: number, duration: number, volume: number) => {
  const audioContext = getAudioContext();
  if (!audioContext) return;

  if (type === 'whitenoise') {
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    noise.connect(gainNode);
    gainNode.connect(audioContext.destination);
    noise.start();
    noise.stop(audioContext.currentTime + duration);
    return;
  }
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

export const playJoinSound = () => {
  playSound('sine', 880, 0.2, 0.5);
  setTimeout(() => playSound('sine', 1046.5, 0.2, 0.5), 200);
};

export const playVoteSound = () => {
  playSound('whitenoise', 0, 0.05, 0.2);
};

export const playRevealSound = () => {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  let time = audioContext.currentTime;
  for (let i = 0; i < 16; i++) {
    setTimeout(() => {
      playSound('triangle', 100 + i * 5, 0.05, 0.3);
    }, i * 50);
  }
};

export const playTimerSound = () => {
  playSound('square', 1200, 0.1, 0.5);
  setTimeout(() => playSound('square', 1200, 0.1, 0.5), 150);
};

export const playFanfareSound = () => {
  playSound('sine', 440, 0.2, 0.5);
  setTimeout(() => playSound('sine', 554.37, 0.2, 0.5), 200);
  setTimeout(() => playSound('sine', 659.25, 0.2, 0.5), 400);
  setTimeout(() => playSound('sine', 880, 0.4, 0.5), 600);
};
