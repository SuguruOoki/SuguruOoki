# React Native バックグラウンド再生・連続再生 調査レポート

## 概要

React Nativeでバックグラウンド再生と連続再生（プレイリスト/キュー管理）を実現するための主要なライブラリと実装方法をまとめます。

---

## ライブラリ比較

| ライブラリ | バックグラウンド再生 | キュー管理 | ロック画面操作 | ギャップレス再生 | 推奨用途 |
|-----------|:------------------:|:---------:|:-------------:|:---------------:|---------|
| **react-native-track-player** | ✅ | ✅ | ✅ | ✅ | 音楽/ポッドキャストアプリ |
| **expo-av** | ✅ | ❌ | ❌ | ❌ | シンプルな音声再生 |
| **expo-audio** (新) | ✅ | ❌ | ❌ | ❌ | expo-avの後継 |
| **react-native-sound** | ❌ | ❌ | ❌ | ❌ | 効果音など短い音声 |
| **react-native-audio-pro** | ✅ | ✅ | ✅ | ✅ | 新しい代替ライブラリ |

---

## 推奨: react-native-track-player

音楽・ポッドキャストアプリなど、本格的なオーディオ再生機能が必要な場合は **react-native-track-player** が最も推奨されます。

### 特徴
- ネイティブ実装による高パフォーマンス
- バックグラウンド再生
- ロック画面・通知センターでの操作
- キュー（プレイリスト）管理
- リピート・シャッフル機能
- iOS / Android / Web 対応

### インストール

```bash
# npm
npm install react-native-track-player

# yarn
yarn add react-native-track-player

# Expo (要カスタムdev client)
npx expo install react-native-track-player
```

### iOS設定

#### 1. Info.plist（またはapp.json）でバックグラウンドモードを有効化

**Xcodeの場合:**
1. プロジェクトを開く
2. Signing & Capabilities → + Capability
3. "Background Modes" を追加
4. "Audio, AirPlay, and Picture in Picture" にチェック

**Expoの場合 (app.json):**
```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    },
    "plugins": [
      [
        "react-native-track-player"
      ]
    ]
  }
}
```

### Android設定

Androidはデフォルトでバックグラウンド再生が動作します。

アプリ終了時の動作を制御する場合:
```typescript
await TrackPlayer.setupPlayer({
  android: {
    appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
  },
});
```

---

## 実装例

### 1. 基本セットアップ

**index.js (エントリーポイント)**
```javascript
import { AppRegistry } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './service';

AppRegistry.registerComponent('MyApp', () => App);

// Playback Serviceを登録（バックグラウンド再生に必須）
TrackPlayer.registerPlaybackService(() => PlaybackService);
```

**service.js (Playback Service)**
```typescript
import TrackPlayer, { Event } from 'react-native-track-player';

export const PlaybackService = async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.destroy());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
};
```

### 2. プレイヤー初期化

```typescript
import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
} from 'react-native-track-player';

const setupPlayer = async () => {
  try {
    await TrackPlayer.setupPlayer({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
    });

    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      progressUpdateEventInterval: 2,
    });

    console.log('Player setup complete');
  } catch (error) {
    console.error('Error setting up player:', error);
  }
};
```

### 3. キュー（連続再生）管理

```typescript
import TrackPlayer, { Track, RepeatMode } from 'react-native-track-player';

// トラックの型定義
interface AudioTrack extends Track {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  duration?: number;
}

// キューにトラックを追加
const addTracksToQueue = async (tracks: AudioTrack[]) => {
  await TrackPlayer.add(tracks);
};

// プレイリストをセット（既存キューをクリアして新規追加）
const setPlaylist = async (tracks: AudioTrack[]) => {
  await TrackPlayer.reset();
  await TrackPlayer.add(tracks);
  await TrackPlayer.play();
};

// 特定のトラックにスキップ
const skipToTrack = async (index: number) => {
  await TrackPlayer.skip(index);
  await TrackPlayer.play();
};

// 次のトラックへ
const skipToNext = async () => {
  await TrackPlayer.skipToNext();
};

// 前のトラックへ
const skipToPrevious = async () => {
  await TrackPlayer.skipToPrevious();
};

// キューからトラックを削除
const removeTrack = async (index: number) => {
  await TrackPlayer.remove(index);
};

// キュー内のトラックを移動
const moveTrack = async (fromIndex: number, toIndex: number) => {
  await TrackPlayer.move(fromIndex, toIndex);
};

// キューをクリア（今後のトラックのみ）
const clearUpcoming = async () => {
  await TrackPlayer.removeUpcomingTracks();
};
```

### 4. リピート機能

```typescript
import TrackPlayer, { RepeatMode } from 'react-native-track-player';

// リピートモードの設定
const setRepeatMode = async (mode: 'off' | 'track' | 'queue') => {
  switch (mode) {
    case 'off':
      await TrackPlayer.setRepeatMode(RepeatMode.Off);
      break;
    case 'track':
      // 現在のトラックをリピート
      await TrackPlayer.setRepeatMode(RepeatMode.Track);
      break;
    case 'queue':
      // プレイリスト全体をリピート
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      break;
  }
};

// 現在のリピートモードを取得
const getRepeatMode = async () => {
  return await TrackPlayer.getRepeatMode();
};
```

### 5. シャッフル機能（カスタム実装）

```typescript
// シャッフル機能（ネイティブ未対応のためJS実装）
const shuffleQueue = async () => {
  const queue = await TrackPlayer.getQueue();
  const currentTrack = await TrackPlayer.getActiveTrack();
  const currentIndex = await TrackPlayer.getActiveTrackIndex();

  if (!currentTrack || currentIndex === undefined) return;

  // 現在のトラック以降をシャッフル
  const upcomingTracks = queue.slice(currentIndex + 1);
  const shuffled = upcomingTracks.sort(() => Math.random() - 0.5);

  // 今後のトラックを削除して、シャッフルしたものを追加
  await TrackPlayer.removeUpcomingTracks();
  await TrackPlayer.add(shuffled);
};

// オリジナルの順序を保持する場合
let originalQueue: Track[] = [];

const shuffleWithRestore = async () => {
  const queue = await TrackPlayer.getQueue();
  const currentIndex = await TrackPlayer.getActiveTrackIndex() ?? 0;

  // オリジナルを保存
  originalQueue = [...queue];

  const currentTrack = queue[currentIndex];
  const otherTracks = queue.filter((_, i) => i !== currentIndex);
  const shuffled = otherTracks.sort(() => Math.random() - 0.5);

  await TrackPlayer.reset();
  await TrackPlayer.add([currentTrack, ...shuffled]);
  await TrackPlayer.play();
};

const restoreOriginalOrder = async () => {
  if (originalQueue.length === 0) return;

  const currentTrack = await TrackPlayer.getActiveTrack();
  const currentPosition = await TrackPlayer.getProgress();

  await TrackPlayer.reset();
  await TrackPlayer.add(originalQueue);

  // 現在のトラックの位置を探して再開
  const newIndex = originalQueue.findIndex(t => t.url === currentTrack?.url);
  if (newIndex !== -1) {
    await TrackPlayer.skip(newIndex);
    await TrackPlayer.seekTo(currentPosition.position);
    await TrackPlayer.play();
  }
};
```

### 6. 進捗状態の監視（Hooks）

```typescript
import { useProgress, usePlaybackState, useActiveTrack } from 'react-native-track-player';

const PlayerScreen = () => {
  const progress = useProgress();
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();

  return (
    <View>
      <Text>{activeTrack?.title}</Text>
      <Text>{activeTrack?.artist}</Text>
      <Text>
        {formatTime(progress.position)} / {formatTime(progress.duration)}
      </Text>
      <Slider
        value={progress.position}
        maximumValue={progress.duration}
        onSlidingComplete={async (value) => {
          await TrackPlayer.seekTo(value);
        }}
      />
    </View>
  );
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
```

---

## expo-av でのバックグラウンド再生

シンプルな用途であれば expo-av も選択肢になります。

### インストール

```bash
npx expo install expo-av
```

### app.json設定

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    }
  }
}
```

### Audio Mode設定

```typescript
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

const setupAudioMode = async () => {
  await Audio.setAudioModeAsync({
    staysActiveInBackground: true,           // バックグラウンドで継続
    playsInSilentModeIOS: true,              // サイレントモードでも再生
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
};
```

### 再生例

```typescript
import { Audio } from 'expo-av';

const playAudio = async () => {
  await setupAudioMode();

  const { sound } = await Audio.Sound.createAsync(
    { uri: 'https://example.com/audio.mp3' },
    { shouldPlay: true }
  );

  // 再生終了時のコールバック
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      // 次のトラックを再生するなど
    }
  });
};
```

### 注意点
- expo-avはキュー管理機能がないため、連続再生は手動実装が必要
- ロック画面のコントロールは非対応
- 新しいプロジェクトでは `expo-audio` への移行が推奨

---

## トラブルシューティング

### iOS

| 問題 | 解決策 |
|------|--------|
| バックグラウンドで停止する | `UIBackgroundModes` に `audio` を追加 |
| サイレントモードで音が出ない | `playsInSilentModeIOS: true` を設定 |
| シミュレータでロック画面操作できない | iOS Simulator 11以降は非対応、実機でテスト |

### Android

| 問題 | 解決策 |
|------|--------|
| アプリ終了後も再生が続く | `appKilledPlaybackBehavior` を設定 |
| 通知が表示されない | Playback Serviceが正しく登録されているか確認 |

### 共通

| 問題 | 解決策 |
|------|--------|
| 再生が始まらない | `setupPlayer()` が完了してから `add()` と `play()` を呼ぶ |
| キューが空になる | `add()` でトラックが正しく追加されているか確認 |

---

## パフォーマンス最適化

### プリロード
```typescript
// 再生前にトラックを事前読み込み
await TrackPlayer.add(tracks);
// 少し待ってから再生開始
setTimeout(() => TrackPlayer.play(), 500);
```

### メモリ管理
```typescript
// 再生済みトラックの削除（大きなプレイリストの場合）
const cleanupPlayedTracks = async () => {
  const currentIndex = await TrackPlayer.getActiveTrackIndex();
  if (currentIndex && currentIndex > 10) {
    // 10トラック以上前のものを削除
    for (let i = 0; i < currentIndex - 10; i++) {
      await TrackPlayer.remove(0);
    }
  }
};
```

---

## 参考リンク

### 公式ドキュメント
- [react-native-track-player 公式サイト](https://rntp.dev/)
- [react-native-track-player GitHub](https://github.com/doublesymmetry/react-native-track-player)
- [expo-av ドキュメント](https://docs.expo.dev/versions/latest/sdk/audio-av/)
- [expo-audio ドキュメント](https://docs.expo.dev/versions/latest/sdk/audio/)

### チュートリアル・ガイド
- [React Native Track Player Complete Guide - LogRocket](https://blog.logrocket.com/react-native-track-player-complete-guide/)
- [Playing Audio in React Native with react-native-track-player](https://addjam.com/blog/2025-04-04/playing-audio-in-react-native/)
- [React Native Track Player Complete Tutorial - Scaler](https://www.scaler.com/topics/react-native-track-player/)
- [How to Add Background Audio to Expo Apps](https://dev.to/josie/how-to-add-background-audio-to-expo-apps-3fgc)
- [Implementing react-native-track-player with Expo - Medium](https://medium.com/@gionata.brunel/implementing-react-native-track-player-with-expo-including-lock-screen-part-1-ios-9552fea5178c)

### 関連ライブラリ
- [react-native-audio-pro](https://github.com/evergrace-co/react-native-audio-pro) - 新しい代替ライブラリ
- [react-native-sound-gapless](https://github.com/Menardi/react-native-sound-gapless) - ギャップレスループ専用

---

## まとめ

| 要件 | 推奨ライブラリ |
|------|---------------|
| 音楽/ポッドキャストアプリ | react-native-track-player |
| シンプルな音声再生 | expo-av / expo-audio |
| バックグラウンド再生必須 | react-native-track-player |
| ロック画面操作必須 | react-native-track-player |
| プレイリスト/キュー管理 | react-native-track-player |
| Expoで簡単に始めたい | expo-av（機能制限あり） |

**結論**: バックグラウンド再生と連続再生の両方が必要な場合は **react-native-track-player** 一択です。
