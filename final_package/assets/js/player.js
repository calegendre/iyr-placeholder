/**
 * itsyourradio player script
 * A robust, cross-browser compatible player for Icecast streams
 */

// Wait for document to be ready
$(document).ready(function() {
  // Configuration
  const config = {
    streams: {
      mp3: 'https://acast.us:8000/radio.mp3',
      m3u: 'https://acast.us/public/itsyourradio/playlist.m3u',
      pls: 'https://acast.us/public/itsyourradio/playlist.pls'
    },
    metadataInterval: 4000, // 4 seconds
    colorTransitionDuration: 1500, // 1.5 seconds
    defaultColors: ['#c3deeb', '#8a6389', '#2e4e7e']
  };

  // Player state
  const state = {
    isPlaying: false,
    isPaused: false,
    currentMetadata: {
      title: '',
      artist: '',
      artworkUrl: ''
    },
    metadataTimer: null,
    lastColors: [...config.defaultColors],
    targetColors: [...config.defaultColors],
    colorTransitionInProgress: false,
    albumArtLoading: false,
    messageTimeout: null
  };

  // DOM elements
  const elements = {
    player: $('#jquery_jplayer_1'),
    container: $('#player-container'),
    playPauseBtn: $('.jp-play'),
    stopBtn: $('.jp-stop'),
    playIcon: $('.play-icon'),
    pauseIcon: $('.pause-icon'),
    trackTitle: $('.track-title'),
    trackArtist: $('.track-artist'),
    volumeBar: $('.jp-volume-bar'),
    volumeBarValue: $('.jp-volume-bar-value'),
    albumArt: $('.album-art'),
    albumImg: $('.album-art img'),
    loadingIndicator: $('.loading-indicator'),
    messageOverlay: $('.message-overlay')
  };

  // Initialize Color Thief for extracting colors from album art
  const colorThief = new ColorThief();

  // Initialize jPlayer
  elements.player.jPlayer({
    ready: function() {
      // Player is ready, but we don't autoplay
      console.log('jPlayer ready');
    },
    supplied: 'mp3',
    solution: 'html',  // Force HTML5 solution
    wmode: 'window',
    preload: 'none',
    volume: 0.7,
    cssSelectorAncestor: '#jp_container_1',
    useStateClassSkin: true,
    autoBlur: false,
    smoothPlayBar: true,
    keyEnabled: true,
    remainingDuration: false,
    toggleDuration: false,
    play: function() {
      state.isPlaying = true;
      state.isPaused = false;
      updatePlayPauseUI(true);
      showMessage('Stream playing', 'success');

      // Start polling for metadata
      fetchMetadata();
    },
    pause: function() {
      state.isPaused = true;
      updatePlayPauseUI(false);
    },
    stop: function() {
      state.isPlaying = false;
      state.isPaused = false;
      updatePlayPauseUI(false);
      resetMetadataDisplay();
      clearTimeout(state.metadataTimer);
    },
    error: function(event) {
      const error = event.jPlayer.error;
      console.error('jPlayer error:', error.message);
      
      // Show error message
      showMessage(`Error: ${error.message}`, 'error');
      
      // Try fallback stream if available
      tryFallbackStream();
    }
  });

  // Set up event listeners
  elements.playPauseBtn.on('click', togglePlayPause);
  elements.stopBtn.on('click', stopPlayback);
  elements.volumeBar.on('click', adjustVolume);
  elements.trackTitle.on('mouseenter', pauseScrolling);
  elements.trackTitle.on('mouseleave', resumeScrolling);
  elements.trackArtist.on('mouseenter', pauseScrolling);
  elements.trackArtist.on('mouseleave', resumeScrolling);
  $(window).on('resize', checkTextOverflow);

  // Play/pause toggle
  function togglePlayPause() {
    if (!state.isPlaying || state.isPaused) {
      playStream();
    } else {
      pauseStream();
    }
  }

  // Play stream
  function playStream() {
    // If paused, just resume
    if (state.isPaused) {
      resumeStream();
      return;
    }

    // Show loading indicator
    elements.loadingIndicator.addClass('visible');
    
    try {
      // Set the stream URL
      elements.player.jPlayer('setMedia', {
        mp3: config.streams.mp3
      });
      
      // Start playback
      elements.player.jPlayer('play');
    } catch(e) {
      console.error('Error starting playback:', e);
      showMessage('Error starting playback', 'error');
      elements.loadingIndicator.removeClass('visible');
    }
  }

  // Pause stream
  function pauseStream() {
    elements.player.jPlayer('pause');
    state.isPaused = true;
    updatePlayPauseUI(false);
    
    // Don't clear metadata timer - we'll keep updating even when paused
    // Fade the display to indicate paused state
    elements.trackTitle.css('opacity', 0.7);
    elements.trackArtist.css('opacity', 0.7);
    elements.albumArt.css('opacity', 0.7);
  }

  // Resume stream after pause
  function resumeStream() {
    elements.player.jPlayer('play');
    state.isPaused = false;
    state.isPlaying = true;
    updatePlayPauseUI(true);
    
    // Restore full opacity
    elements.trackTitle.css('opacity', 1);
    elements.trackArtist.css('opacity', 1);
    elements.albumArt.css('opacity', 1);
  }

  // Stop playback
  function stopPlayback() {
    elements.player.jPlayer('stop');
    resetMetadataDisplay();
    clearTimeout(state.metadataTimer);
    state.metadataTimer = null;
    
    // Reset colors to default
    updateGradientColors(config.defaultColors);
  }

  // Reset metadata display
  function resetMetadataDisplay() {
    elements.trackTitle.text('Press play to start stream');
    elements.trackArtist.text('');
    elements.albumImg.removeClass('visible');
    elements.albumArt.removeClass('has-art');
    state.currentMetadata = {
      title: '',
      artist: '',
      artworkUrl: ''
    };
  }

  // Try fallback stream if main stream fails
  function tryFallbackStream() {
    if (config.streams.m3u && config.streams.mp3 !== config.streams.m3u) {
      showMessage('Trying backup stream...', 'info');
      
      // Swap the streams
      const temp = config.streams.mp3;
      config.streams.mp3 = config.streams.m3u;
      config.streams.m3u = temp;
      
      // Try to play again
      elements.player.jPlayer('setMedia', {
        mp3: config.streams.mp3
      });
      
      elements.player.jPlayer('play');
    } else {
      elements.loadingIndicator.removeClass('visible');
    }
  }

  // Update play/pause UI
  function updatePlayPauseUI(isPlaying) {
    if (isPlaying) {
      elements.playIcon.hide();
      elements.pauseIcon.show();
      elements.loadingIndicator.removeClass('visible');
    } else {
      elements.playIcon.show();
      elements.pauseIcon.hide();
    }
  }

  // Fetch metadata from Icecast server
  function fetchMetadata() {
    // Clear any existing timer
    clearTimeout(state.metadataTimer);
    
    // Get the metadata
    const timestamp = new Date().getTime(); // Prevent caching
    const metadataUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://acast.us:8000/status-json.xsl?nocache=' + timestamp)}`;
    
    $.ajax({
      url: metadataUrl,
      dataType: 'json',
      timeout: 5000, // 5 second timeout
      success: function(data) {
        try {
          if (data && data.icestats && data.icestats.source) {
            // Handle either single source or array of sources
            let source = data.icestats.source;
            if (Array.isArray(source)) {
              // Find the matching source (usually looking for radio.mp3 in URL)
              source = source.find(src => src.listenurl && src.listenurl.includes('radio.mp3'));
            }
            
            if (source && source.title) {
              processMetadata(source.title);
            }
          }
        } catch (error) {
          console.error('Error processing metadata:', error);
          // Try fallback option if needed
          tryFallbackMetadata();
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching metadata:', error);
        // Try fallback option
        tryFallbackMetadata();
      },
      complete: function() {
        // Schedule next update if we're still playing
        if (state.isPlaying) {
          state.metadataTimer = setTimeout(fetchMetadata, config.metadataInterval);
        }
      }
    });
  }

  // Try alternative method of getting metadata
  function tryFallbackMetadata() {
    const timestamp = new Date().getTime();
    const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://acast.us/public/itsyourradio/playlist.m3u?nocache=' + timestamp)}`;
    
    $.ajax({
      url: fallbackUrl,
      dataType: 'text',
      timeout: 5000,
      success: function(data) {
        const lines = data.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('#EXTINF:')) {
            // Extract metadata from format: #EXTINF:-1,Artist - Title
            const metaStart = line.indexOf(',');
            if (metaStart > 0) {
              const metaText = line.substring(metaStart + 1);
              processMetadata(metaText);
              break;
            }
          }
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching fallback metadata:', error);
        // If all else fails, at least show playing status
        if (state.isPlaying && !state.currentMetadata.title) {
          updateMetadataDisplay('itsyourradio', 'Live Stream');
        }
      }
    });
  }

  // Process raw metadata string
  function processMetadata(metadataString) {
    if (!metadataString) return;
    
    let title = metadataString;
    let artist = '';
    
    // Split artist and title if using common format "Artist - Title"
    if (metadataString.includes(' - ')) {
      const parts = metadataString.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    }
    
    // Only update if metadata has changed
    if (title !== state.currentMetadata.title || artist !== state.currentMetadata.artist) {
      updateMetadataDisplay(artist, title);
      fetchAlbumArtwork(artist, title);
    }
  }

  // Update metadata display with fade effect
  function updateMetadataDisplay(artist, title) {
    // Fade out current
    elements.trackTitle.fadeOut(300, function() {
      $(this).text(title || 'Unknown Track').fadeIn(300, function() {
        checkTextOverflow();
      });
    });
    
    elements.trackArtist.fadeOut(300, function() {
      $(this).text(artist || '').fadeIn(300, function() {
        checkTextOverflow();
      });
    });
    
    // Update state
    state.currentMetadata.title = title;
    state.currentMetadata.artist = artist;
  }

  // Check if text needs scrolling effect
  function checkTextOverflow() {
    if (elements.trackTitle[0].scrollWidth > elements.trackTitle.width()) {
      elements.trackTitle.addClass('scrolling');
    } else {
      elements.trackTitle.removeClass('scrolling');
    }
    
    if (elements.trackArtist[0].scrollWidth > elements.trackArtist.width()) {
      elements.trackArtist.addClass('scrolling');
    } else {
      elements.trackArtist.removeClass('scrolling');
    }
  }

  // Pause scrolling on hover
  function pauseScrolling() {
    $(this).css('animation-play-state', 'paused');
  }

  // Resume scrolling on mouse leave
  function resumeScrolling() {
    $(this).css('animation-play-state', 'running');
  }

  // Fetch album artwork
  function fetchAlbumArtwork(artist, title) {
    if (!artist && !title) return;
    if (state.albumArtLoading) return;
    
    state.albumArtLoading = true;
    
    // Try LastFM API first
    const lastFmApiKey = '1f633977acf0e2d92aeae0180cc16efa'; // Demo key
    const lastFmUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${lastFmApiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`;
    
    $.ajax({
      url: lastFmUrl,
      dataType: 'json',
      timeout: 5000,
      success: function(data) {
        let artworkUrl = '';
        
        // Extract album art URL from response
        if (data.track && data.track.album && data.track.album.image) {
          const images = data.track.album.image;
          // Get large or extralarge image
          const largeImage = images.find(img => img.size === 'large' || img.size === 'extralarge');
          if (largeImage && largeImage['#text']) {
            artworkUrl = largeImage['#text'];
          }
        }
        
        if (artworkUrl) {
          updateAlbumArt(artworkUrl);
        } else {
          // If no image from track, try album search
          const albumSearchUrl = `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&api_key=${lastFmApiKey}&format=json`;
          
          $.ajax({
            url: albumSearchUrl,
            dataType: 'json',
            timeout: 5000,
            success: function(albumData) {
              if (albumData.results && albumData.results.albummatches && 
                  albumData.results.albummatches.album && 
                  albumData.results.albummatches.album.length > 0) {
                
                const firstAlbum = albumData.results.albummatches.album[0];
                if (firstAlbum.image) {
                  const largeAlbumImage = firstAlbum.image.find(img => img.size === 'large' || img.size === 'extralarge');
                  if (largeAlbumImage && largeAlbumImage['#text']) {
                    artworkUrl = largeAlbumImage['#text'];
                    updateAlbumArt(artworkUrl);
                  } else {
                    tryItunesFallback(artist, title);
                  }
                } else {
                  tryItunesFallback(artist, title);
                }
              } else {
                tryItunesFallback(artist, title);
              }
            },
            error: function() {
              tryItunesFallback(artist, title);
            },
            complete: function() {
              state.albumArtLoading = false;
            }
          });
        }
      },
      error: function() {
        tryItunesFallback(artist, title);
      }
    });
  }

  // Try iTunes as fallback for album art
  function tryItunesFallback(artist, title) {
    const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`;
    
    $.ajax({
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(iTunesUrl)}`,
      dataType: 'json',
      timeout: 5000,
      success: function(data) {
        if (data.results && data.results.length > 0) {
          const artworkUrl = data.results[0].artworkUrl100.replace('100x100', '300x300');
          updateAlbumArt(artworkUrl);
        } else {
          // No artwork found
          state.albumArtLoading = false;
        }
      },
      error: function() {
        state.albumArtLoading = false;
      }
    });
  }

  // Update album art display
  function updateAlbumArt(artworkUrl) {
    if (!artworkUrl || artworkUrl === state.currentMetadata.artworkUrl) {
      state.albumArtLoading = false;
      return;
    }
    
    // Create an image object to load the artwork
    const img = new Image();
    
    img.crossOrigin = 'Anonymous';
    
    img.onload = function() {
      // Fade out current
      elements.albumImg.removeClass('visible');
      
      setTimeout(function() {
        // Update source and fade in
        elements.albumImg.attr('src', artworkUrl)
          .addClass('visible');
        
        elements.albumArt.addClass('has-art');
        
        // Extract colors and update gradient
        try {
          const palette = colorThief.getPalette(img, 3);
          const colors = palette.map(color => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
          updateGradientColors(colors);
        } catch (e) {
          console.error('Error extracting colors:', e);
        }
        
        // Update state
        state.currentMetadata.artworkUrl = artworkUrl;
        state.albumArtLoading = false;
      }, 300);
    };
    
    img.onerror = function() {
      // Handle image loading error
      elements.albumImg.removeClass('visible');
      elements.albumArt.removeClass('has-art');
      state.albumArtLoading = false;
    };
    
    img.src = artworkUrl;
  }

  // Update gradient colors for the player border
  function updateGradientColors(colors) {
    state.targetColors = colors;
    
    // Animate transition between colors
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      #player-container::before {
        background: linear-gradient(90deg, ${colors[0]}, ${colors[1]}, ${colors[2]});
        box-shadow: 0 0 20px 5px ${colors[1].replace('rgb', 'rgba').replace(')', ', 0.8)')};
      }
    `;
    
    // Replace existing style if it exists, otherwise append
    const existingStyle = document.getElementById('gradientStyle');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    styleTag.id = 'gradientStyle';
    document.head.appendChild(styleTag);
  }

  // Adjust volume on click
  function adjustVolume(e) {
    const offset = $(this).offset();
    const x = e.pageX - offset.left;
    const width = $(this).width();
    const percentage = x / width;
    
    // Set the value visually
    elements.volumeBarValue.width(percentage * 100 + '%');
    
    // Set the volume
    elements.player.jPlayer('volume', percentage);
  }

  // Show message overlay
  function showMessage(message, type) {
    // Clear any existing timeout
    if (state.messageTimeout) {
      clearTimeout(state.messageTimeout);
    }
    
    // Update message and show
    elements.messageOverlay
      .removeClass('error success info')
      .addClass(type)
      .text(message)
      .addClass('visible');
    
    // Hide after 3 seconds
    state.messageTimeout = setTimeout(function() {
      elements.messageOverlay.removeClass('visible');
    }, 3000);
  }
});