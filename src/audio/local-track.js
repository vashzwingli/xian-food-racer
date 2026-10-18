import homeSongUrl from "../../assets/audio/xian-ren-de-ge.mp3";

const HOME_SONG = "西安人的歌 · 程渤智（现场版）";
const DB_NAME = "changan-night-radio";
const STORE = "tracks";
const KEY = "home-song";

function openStore() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB)
      return reject(
        new Error("当前浏览器不能保存音乐，关闭页面后需重新导入。"),
      );
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}
async function storedTrack(action, value) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      STORE,
      action === "get" ? "readonly" : "readwrite",
    );
    const store = tx.objectStore(STORE);
    const req =
      action === "get"
        ? store.get(KEY)
        : action === "put"
          ? store.put(value, KEY)
          : store.delete(KEY);
    let result;
    req.onsuccess = () => {
      result = req.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = tx.onerror;
  });
}

export class LocalTrack {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.element = new Audio();
    this.element.loop = true;
    this.element.preload = "metadata";
    this.name = HOME_SONG;
    this.home = true;
    this.selected = true;
    this.element.src = homeSongUrl;
    this.volume = 0.62;
    this.message =
      "已内置《西安人的歌》现场版。点击发车或试听，让乡音陪你回家。";
    this.url = null;
    this.starting = false;
    this.intent = false;
    this.serial = 0;
    this.element.addEventListener("error", () => {
      this.selected = false;
      this.message = this.home
        ? "内置歌曲暂时无法解码，已切换原创配乐。也可导入自己的音频。"
        : "这份音频未能播放，已切换原创配乐。请换成 MP3、M4A、OGG 或 WAV。";
      this.onChange();
    });
    this.ready = this.restore();
  }
  async restore() {
    try {
      const saved = await storedTrack("get");
      if (saved?.blob) {
        this.useBlob(saved.blob, saved.name);
        this.message = "已记住这首歌。点击发车或试听开始播放。";
      }
      if (saved) {
        this.volume = saved.volume ?? this.volume;
        if (saved.mode === "home") this.useHome();
        this.selected = saved.mode
          ? saved.mode !== "original"
          : saved.selected !== false;
      }
    } catch {
      /* Local file origins and private mode may disable persistent storage. */
    }
    this.onChange();
  }
  useBlob(blob, name) {
    this.serial++;
    this.blocked = false;
    this.element.pause();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    this.element.src = this.url;
    this.blob = blob;
    this.localName = name;
    this.home = false;
    this.name = name;
    this.element.load();
  }
  useHome() {
    this.serial++;
    this.blocked = false;
    this.element.pause();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.home = true;
    this.name = HOME_SONG;
    this.element.src = homeSongUrl;
    this.element.load();
  }
  selectHome() {
    this.useHome();
    this.selected = true;
    this.message = "正在收听《西安人的歌》现场版，循环播放。";
    this.persist();
    this.onChange();
  }
  attach(context, analyser) {
    if (this.context) return;
    this.context = context;
    this.source = context.createMediaElementSource(this.element);
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.source.connect(this.gain).connect(analyser);
  }
  async importFile(file) {
    if (!file) return;
    if (file.size > 40 * 1024 * 1024)
      throw new Error("请选择 40 MB 以内的音频。");
    if (
      !file.type.startsWith("audio/") &&
      !/\.(mp3|m4a|ogg|wav|flac|aac)$/i.test(file.name)
    )
      throw new Error("请选择音频文件。");
    const probe = new Audio();
    const url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("音频读取超时，请换一个文件。")),
          10000,
        );
        const finish = (error) => {
          clearTimeout(timer);
          error ? reject(error) : resolve();
        };
        probe.onloadedmetadata = () =>
          finish(
            Number.isFinite(probe.duration) && probe.duration > 0
              ? null
              : new Error("这份音频没有可播放的内容。"),
          );
        probe.onerror = () =>
          finish(new Error("无法读取这份音频，请换成 MP3、M4A、OGG 或 WAV。"));
        probe.src = url;
      });
    } finally {
      probe.removeAttribute("src");
      probe.load();
      URL.revokeObjectURL(url);
    }
    this.useBlob(file, file.name.replace(/\.[^.]+$/, ""));
    this.selected = true;
    this.message = "已导入，循环播放。音乐只保存在这台设备。";
    await this.persist();
    this.onChange();
  }
  async persist() {
    try {
      await storedTrack("put", {
        blob: this.blob,
        name: this.localName,
        mode: !this.selected ? "original" : this.home ? "home" : "local",
        selected: this.selected,
        volume: this.volume,
      });
    } catch {
      this.message = this.blob
        ? "本次可播放；浏览器未允许保存，下次打开需重新导入。"
        : "本次设置已生效；浏览器未允许保存，下次打开会恢复默认。";
    }
  }
  selectLocal() {
    if (this.blob) {
      if (this.home) this.useBlob(this.blob, this.localName);
      this.selected = true;
      this.persist();
      this.onChange();
    }
  }
  selectOriginal() {
    this.serial++;
    this.selected = false;
    this.element.pause();
    this.persist();
    this.onChange();
  }
  async remove() {
    this.serial++;
    this.selected = false;
    this.element.pause();
    this.blob = null;
    this.localName = "";
    this.useHome();
    this.selected = true;
    this.blocked = false;
    try {
      await storedTrack("delete");
    } catch {}
    this.message = "本地音乐已移除，继续听内置《西安人的歌》。";
    this.onChange();
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.persist();
  }
  sync(enabled, state, hidden = false) {
    const active = !!(
      this.selected &&
      (this.home || this.blob) &&
      enabled &&
      !hidden
    );
    this.intent = active;
    if (this.gain)
      this.gain.gain.setTargetAtTime(
        active
          ? this.volume *
              (state === "paused" ? 0.25 : state === "race" ? 0.8 : 0.65)
          : 0,
        this.context.currentTime,
        0.18,
      );
    if (!active) {
      if (!this.element.paused) this.element.pause();
      return;
    }
    if (
      this.context &&
      this.element.paused &&
      !this.starting &&
      !this.blocked
    ) {
      this.starting = true;
      const serial = this.serial;
      this.element
        .play()
        .then(() => {
          if (serial === this.serial && !this.intent) this.element.pause();
        })
        .catch(() => {
          if (serial !== this.serial || !this.intent) return;
          this.blocked = true;
          this.message = "点击“试听 / 继续播放”即可开始。";
          this.onChange();
        })
        .finally(() => {
          this.starting = false;
        });
    }
  }
  snapshot() {
    return {
      name: this.name,
      selected: this.selected,
      hasFile: !!this.blob,
      source: !this.selected ? "original" : this.home ? "home" : "local",
      duration: Number.isFinite(this.element.duration)
        ? this.element.duration
        : 0,
      readyState: this.element.readyState,
      paused: this.element.paused,
      loop: this.element.loop,
      currentTime: this.element.currentTime,
      volume: this.volume,
      gain: this.gain?.gain.value ?? 0,
      message: this.message,
    };
  }
  dispose() {
    this.element.pause();
    if (this.url) URL.revokeObjectURL(this.url);
    this.source?.disconnect();
    this.gain?.disconnect();
  }
}
