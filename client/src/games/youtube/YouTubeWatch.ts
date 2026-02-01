import { BaseGame, type GameAction } from "../BaseGame";

export interface YouTubeWatchState {
  videoId: string;
  isPlaying: boolean;
  timestamp: number;
  lastUpdate: number;
  allowGuestControl: boolean;
}

export interface YouTubeWatchAction extends GameAction {
  type: "SET_VIDEO" | "TOGGLE_GUEST_CONTROL";
  payload?: any;
}

export default class YouTubeWatch extends BaseGame<YouTubeWatchState> {
  getInitState(): YouTubeWatchState {
    return {
      videoId: "",
      isPlaying: false,
      timestamp: 0,
      lastUpdate: Date.now(),
      allowGuestControl: false,
    };
  }

  onSocketGameAction(data: { action: GameAction }): void {
    const action = data.action as YouTubeWatchAction;

    if (!this.isHost) return;

    switch (action.type) {
      case "SET_VIDEO":
        this.handleSetVideo(action.payload);
        break;
      case "TOGGLE_GUEST_CONTROL":
        this.handleToggleGuestControl(action.payload);
        break;
    }
  }

  sync(playing: boolean, currentTime: number) {
    this.state.isPlaying = playing;
    this.state.timestamp = currentTime;
  }

  private handleSetVideo(videoId: string) {
    if (!this.isHost) return;
    this.state.videoId = videoId;
    this.state.isPlaying = true;
    this.state.timestamp = 0;
    this.state.lastUpdate = Date.now();
  }

  private handleToggleGuestControl(allow: boolean) {
    if (!this.isHost) return;
    this.state.allowGuestControl = allow;
  }

  // Public methods

  public setVideo(urlOrId: string) {
    const videoId = this.extractVideoId(urlOrId);
    if (!videoId) return;

    const action: YouTubeWatchAction = {
      type: "SET_VIDEO",
      payload: videoId,
    };
    this.makeAction(action);
  }

  public toggleGuestControl(allow: boolean) {
    const action: YouTubeWatchAction = {
      type: "TOGGLE_GUEST_CONTROL",
      payload: allow,
    };
    this.makeAction(action);
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
}
