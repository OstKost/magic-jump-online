/** Two distinct heroes, chosen in order, then two independent ready signals. */
export class Journey {
  count = 2;
  selected: number[] = [0, 1];
  choosing: 0 | 1 = 0;
  ready: boolean[] = [false, false];
  maxHero = 6;
  reset(count = this.count) { this.count = count; this.selected = Array.from({length:count},(_,i)=>i); this.choosing = 0; this.resetReady(); }
  choose(character: number) {
    if (!Number.isInteger(character) || character < 0 || character > this.maxHero) return false;
    if (this.choosing === 1 && character === this.selected[0]) return false;
    this.selected[this.choosing] = character;
    return true;
  }
  confirm() {
    if (this.choosing < this.count - 1) {
      this.choosing = 1;
      if (this.selected[1] === this.selected[0]) this.selected[1] = (this.selected[0] + 1) % (this.maxHero + 1);
      return false;
    }
    return true;
  }
  resetReady() { this.ready = Array(this.count).fill(false); }
  markReady(player: number) {
    if (Number.isInteger(player) && player >= 0 && player < this.count) this.ready[player] = true;
    return this.ready.every(Boolean);
  }
}
