# IYR Player - Stunning Audio Player with Dynamic Themes

A beautiful, responsive HTML5 audio player with dynamic color themes that adapts to album artwork. Perfect for radio stations, music websites, and any project needing a sophisticated audio player.

![IYR Player Preview](./preview.png)

## Features

- **Beautiful Design**: Clean, modern interface with animated gradient border
- **Dynamic Theming**: Colors automatically extracted from album artwork
- **Metadata Integration**: Real-time display of track information
- **Responsive Layout**: Works perfectly on all device sizes
- **Streaming Support**: Reliable playback of audio streams with fallback options
- **Multiple Format Support**: MP3, AAC, playlist formats, and more
- **Album Artwork**: Automatic fetching from stream metadata or external APIs
- **Simple Integration**: Easy to add to any website with minimal code
- **Customizable**: Adaptable to your brand and website design

## Quick Start

### 1. Include Required Files

```html
<!-- CSS -->
<link rel="stylesheet" href="assets/css/player.css">

<!-- Scripts -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="assets/js/jplayer.min.js"></script>
<script src="assets/js/color-thief.min.js"></script>
<script src="assets/js/player.js"></script>
```

### 2. Add HTML Structure

```html
<!-- Player HTML -->
<div id="player-container">
  <div class="album-art">
    <svg viewBox="0 0 24 24">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
    <img src="" alt="Album Art">
  </div>
  
  <div class="track-info">
    <p class="track-title"></p>
    <p class="track-artist"></p>
  </div>
  
  <div class="controls-area">
    <div id="jp_container_1">
      <div class="jp-controls">
        <button class="jp-play" role="button" aria-label="play pause">
          <svg class="play-icon" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg class="pause-icon" viewBox="0 0 24 24" style="display: none;">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>
        <button class="jp-stop" role="button" aria-label="stop">
          <svg viewBox="0 0 24 24">
            <path d="M6 6h12v12H6z"/>
          </svg>
        </button>
        <div class="volume-control">
          <button class="jp-mute" role="button" aria-label="mute">
            <svg viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>
          <div class="jp-volume-bar">
            <div class="jp-volume-bar-value" style="width: 70%;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="loading-indicator"></div>
  <div class="message-overlay"></div>
</div>

<div id="jquery_jplayer_1"></div>
```

### 3. Initialize the Player

```javascript
$(document).ready(function() {
  IYRPlayer.init({
    // Required settings
    selector: '#jquery_jplayer_1',
    containerSelector: '#player-container',
    streams: {
      mp3: 'https://example.com/stream.mp3',
      aacp: 'https://example.com/stream.aacp'
    },
    
    // Optional settings
    metadataUrl: 'https://example.com/api/nowplaying/1',
    metadataApiKey: 'your-api-key',
    metadataInterval: 4000,
    volume: 0.7,
    autoplay: false,
    lastFmAPIKey: 'your-lastfm-api-key'
  });
});
```

## Configuration Options

### Basic Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `selector` | String | `'#jquery_jplayer_1'` | Selector for jPlayer container |
| `containerSelector` | String | `'#player-container'` | Selector for the player bar container |
| `streams.mp3` | String | - | Primary MP3 stream URL |
| `streams.aacp` | String | - | Secondary AACP stream URL |
| `streams.m3u` | String | - | M3U playlist URL (fallback) |
| `streams.pls` | String | - | PLS playlist URL (fallback) |
| `volume` | Number | `0.7` | Initial volume (0-1) |
| `autoplay` | Boolean | `false` | Whether to start playing automatically |

### Metadata Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `metadataUrl` | String | - | URL for the metadata API |
| `metadataApiKey` | String | `null` | API key for metadata requests |
| `metadataInterval` | Number | `4000` | Interval between metadata updates (ms) |
| `lastFmAPIKey` | String | `null` | Last.fm API key for artwork fallback |

### Appearance Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultColors` | Array | `['#c3deeb', '#8a6389', '#2e4e7e']` | Default gradient colors |
| `artworkFadeTime` | Number | `300` | Fade time for artwork transitions (ms) |

## API Methods

The IYR Player provides several methods that you can use to control playback:

### Playback Control

```javascript
// Start playback
IYRPlayer.play();

// Pause playback
IYRPlayer.pause();

// Resume playback
IYRPlayer.resume();

// Toggle play/pause
IYRPlayer.togglePlayPause();

// Stop playback
IYRPlayer.stop();
```

### Volume Control

```javascript
// Set volume (0-1)
IYRPlayer.elements.player.jPlayer('volume', 0.5);
```

### Other Controls

```javascript
// Show message
IYRPlayer.showMessage('Your message', 'success'); // Types: 'success', 'error', 'info'

// Update gradient colors manually
IYRPlayer.updateGradientColors(['#ff0000', '#00ff00', '#0000ff']);
```

## Integration with Azuracast

The player works seamlessly with Azuracast radio streaming servers. To connect to an Azuracast instance:

1. Set your stream URLs to your Azuracast stream endpoints
2. Configure the metadata URL to your Azuracast Now Playing API
3. Add your API key if required

Example Azuracast configuration:

```javascript
IYRPlayer.init({
  streams: {
    mp3: 'https://your-azuracast-server.com:8000/radio.mp3',
    aacp: 'https://your-azuracast-server.com:8000/radio.aacp'
  },
  metadataUrl: 'https://your-azuracast-server.com/api/nowplaying/1',
  metadataApiKey: 'your-api-key'
});
```

## Customizing Appearance

The player can be easily customized by modifying the CSS. Here are some common customizations:

### Changing the Player Height

```css
#player-container {
  height: 120px; /* Default is 100px */
}
```

### Changing the Border Glow Color

```css
#player-container::before {
  box-shadow: 0 0 20px 5px rgba(255, 0, 0, 0.8); /* Red glow */
}
```

### Changing the Background Color

```css
#player-container {
  background-color: rgba(0, 0, 0, 0.9); /* Darker background */
}
```

### Customizing Animation Speed

```css
@keyframes borderAnimation {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

#player-container.active::before {
  animation: borderAnimation 2s linear infinite; /* Faster animation (default is 3s) */
}
```

## Browser Compatibility

The IYR Player works in all modern browsers:

- Chrome 49+
- Firefox 52+
- Safari 10+
- Edge 14+
- Opera 36+
- iOS Safari 10+
- Android Browser 5+

## Dependencies

- jQuery 3.x
- jPlayer 2.9.2
- ColorThief 2.3.0

## License

This player is provided for your use under the MIT License.

## Support

For questions or assistance, please contact itsyourradio support.