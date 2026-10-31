/** Original procedural platformer score; no external recordings. */
export class GameAudio {
  private context?: AudioContext;
  private timer?: ReturnType<typeof setInterval>;
  private step = 0;
  sound = this.read('sound');
  music = this.read('music');
  world = 0;
  active = false;
  onlineActive = false;
  private voices=0;
  private lastBonus=0;
  private read(key: string) { try { return localStorage.getItem(key) !== 'false'; } catch { return true; } }
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
      this.timer ??= setInterval(() => this.advance(), 180);
    } catch { /* Audio is optional on unsupported devices. */ }
  }
  toggle(channel: 'sound' | 'music') {
    this[channel] = !this[channel];
    try { localStorage.setItem(channel, String(this[channel])); } catch { /* Private browsing. */ }
  }
  tone(frequency: number, duration = .12, delay = 0, type: OscillatorType = 'sine', volume = .035, end = frequency) {
    const c = this.context;
    if (!c || c.state !== 'running' || this.voices>=32) return;
    this.voices++;
    const start = c.currentTime + delay;
    const oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(c.destination);
    oscillator.onended = () => { this.voices--; oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration);
  }
  effect(kind: 'bonus' | 'hit' | 'jump' | 'cast' | 'fall' | 'duck' | 'dash', hero = 'sofia') {
    if (!this.sound) return;
    this.unlock();
    if (kind === 'bonus') { if(performance.now()-this.lastBonus<45)return;this.lastBonus=performance.now(); this.tone(1047, .07); this.tone(1568, .12, .065); return; }
    if (kind === 'fall') { this.tone(480,.45,0,'triangle',.045,35);this.tone(110,.15,.3,'sine',.025,55);return; }
    if (kind === 'hit') { this.tone(180,.16,0,'square',.025,60);return; }
    const styles: Record<string, [number, OscillatorType]> = { sofia: [520, 'sine'], stella: [160, 'sawtooth'], air: [880, 'sine'], earth: [90, 'triangle'], kai: [720, 'square'], leya: [390, 'triangle'] };
    const [frequency, type] = styles[hero] ?? styles.sofia;
    if(kind==='duck'){this.tone(frequency,.08,0,type,.015,frequency*.5);return;}
    if(kind==='dash'){this.noise(hero);this.tone(frequency*1.5,.18,0,'sine',.03,frequency*.6);return;}
    if(kind==='cast')this.noise(hero);
    this.tone(frequency, kind === 'cast' ? .25 : .14, 0, type, .025, frequency * (kind === 'cast' ? .4 : 1.8));
  }
  private noise(hero: string) {
    const c=this.context;if(!c||this.voices>=32)return;
    const duration=hero==='earth'?.28:.16;
    const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    source.buffer=buffer;filter.type=hero==='air'?'highpass':'lowpass';
    filter.frequency.value=({sofia:1800,stella:950,air:2600,earth:160,kai:4000,leya:1200} as Record<string,number>)[hero]??1000;
    gain.gain.setValueAtTime(.035,c.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);
    source.connect(filter);filter.connect(gain);gain.connect(c.destination);this.voices++;
    source.onended=()=>{this.voices--;source.disconnect();filter.disconnect();gain.disconnect();};source.start();source.stop(c.currentTime+duration);
  }
  private advance() {
    if (!(this.active||this.onlineActive) || !this.music || document.hidden) return;
    const themes = [[0,4,7,12,7,4,9,7], [0,7,12,4,9,7,4,2], [0,3,7,10,14,10,7,3], [0,3,5,7,10,7,5,3], [0,1,5,7,12,7,5,1]];
    const notes = themes[this.world % themes.length];
    const index = this.step++;
    this.tone(261.63 * 2 ** (notes[index % notes.length] / 12), .16, 0, 'triangle', .012);
    if (index % 4 === 0) this.tone(130.81, .3, 0, 'sine', .018);
  }
}
export const gameAudio = new GameAudio();
document.addEventListener('pointerdown', () => gameAudio.unlock(), { once: true });
document.addEventListener('keydown', () => gameAudio.unlock(), { once: true });
