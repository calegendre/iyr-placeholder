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
      aacp: 'https://acast.us:8000/radio.aacp',
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
    messageTimeout: null,
    failCount: 0  // Count of attempts to play different stream formats
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
    supplied: 'mp3, aacp', // Support multiple formats
    solution: 'html, flash',  // Try HTML5 first, then Flash if needed
    wmode: 'window',
    preload: 'metadata',
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
      
      // Add animation class to player container
      elements.container.addClass('active');

      // Start polling for metadata
      fetchMetadata();
    },
    pause: function() {
      state.isPaused = true;
      updatePlayPauseUI(false);
      
      // Don't remove animation class when paused (only on stop)
    },
    stop: function() {
      state.isPlaying = false;
      state.isPaused = false;
      updatePlayPauseUI(false);
      resetMetadataDisplay();
      clearTimeout(state.metadataTimer);
      
      // Remove animation class
      elements.container.removeClass('active');
    },
    error: function(event) {
      const error = event.jPlayer.error;
      console.log('jPlayer error:', error.message);
      
      // Increment fail count
      state.failCount++;
      
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
      // Set the stream URL with multiple formats for fallback
      elements.player.jPlayer('setMedia', {
        mp3: config.streams.mp3,
        aacp: config.streams.aacp
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
    
    // Make sure animation is active
    elements.container.addClass('active');
  }

  // Stop playback
  function stopPlayback() {
    elements.player.jPlayer('stop');
    resetMetadataDisplay();
    clearTimeout(state.metadataTimer);
    state.metadataTimer = null;
    
    // Reset colors to default
    updateGradientColors(config.defaultColors);
    
    // Remove animation class
    elements.container.removeClass('active');
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

  // Try fallback stream URLs when main stream fails
  function tryFallbackStream() {
    // Check if we have any fallback options
    if (config.streams.m3u || config.streams.pls || config.streams.aacp) {
      showMessage('Trying backup stream...', 'info');
      
      // If main stream failed, try the alternative streams
      if (state.failCount === 1) {
        console.log('Trying aacp stream');
      } else if (state.failCount === 2) {
        console.log('Trying m3u playlist');
        // Now try the m3u playlist
        config.streams.mp3 = config.streams.m3u;
      } else if (state.failCount === 3) {
        console.log('Trying pls playlist');
        // Finally try the pls playlist
        config.streams.mp3 = config.streams.pls;
      } else {
        // If we've tried all formats, reset the counter
        console.log('All stream formats tried, resetting');
        state.failCount = 0;
        elements.loadingIndicator.removeClass('visible');
        return;
      }
      
      // Try to play again
      elements.player.jPlayer('setMedia', {
        mp3: config.streams.mp3,
        aacp: config.streams.aacp
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

  // Fetch metadata from Azuracast API
  function fetchMetadata() {
    // Clear any existing timer
    clearTimeout(state.metadataTimer);
    
    // Get the metadata from Azuracast API using station ID 1
    const nowPlayingUrl = 'https://acast.us/api/nowplaying/1';
    
    $.ajax({
      url: nowPlayingUrl,
      dataType: 'json',
      timeout: 5000, // 5 second timeout
      headers: {
        'X-API-Key': '3e0fbebad23a39d7:3bf8c0250ddd8d1995a085942eb8aefd'
      },
      success: function(data) {
        try {
          if (data && data.now_playing) {
            const nowPlaying = data.now_playing;
            const song = nowPlaying.song || {};
            
            // Get title and artist
            const title = song.title || 'Unknown Track';
            const artist = song.artist || '';
            
            // Process title and artist
            updateMetadataDisplay(artist, title);
            
            // Get album art
            if (song.art) {
              updateAlbumArt(song.art);
            } else {
              // Fallback to LastFM if no art is provided
              fetchAlbumArtwork(artist, title);
            }
          }
        } catch (error) {
          console.error('Error processing Azuracast metadata:', error);
          // Fallback to old method
          tryFallbackMetadata();
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching Azuracast metadata:', error);
        // Fallback to old method
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

  // Try to get album art from Azuracast
  function tryAzuracastArtwork(serverName, listenUrl) {
    // Azuracast often provides album art via a special endpoint
    if (listenUrl) {
      const baseUrl = listenUrl.substring(0, listenUrl.lastIndexOf('/'));
      const artworkUrl = `${baseUrl}/art/nowplaying.jpg?_=${new Date().getTime()}`;
      
      // Check if the artwork exists
      $.ajax({
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(artworkUrl)}`,
        type: 'HEAD',
        success: function() {
          // If we get here, the artwork exists
          updateAlbumArt(artworkUrl);
        },
        error: function() {
          // Try other methods to get artwork
          if (state.currentMetadata.artist && state.currentMetadata.title) {
            fetchAlbumArtwork(state.currentMetadata.artist, state.currentMetadata.title);
          }
        }
      });
    }
  }

  // Try fallback metadata fetching method
  function tryFallbackMetadata() {
    // Fallback to the original Icecast JSON metadata endpoint
    const timestamp = new Date().getTime(); // Prevent caching
    const metadataUrl = `https://acast.us:8000/status-json.xsl?nocache=${timestamp}`;
    
    $.ajax({
      url: metadataUrl,
      dataType: 'json',
      timeout: 5000,
      success: function(data) {
        try {
          if (data && data.icestats && data.icestats.source) {
            // Handle either single source or array of sources
            let source = data.icestats.source;
            if (Array.isArray(source)) {
              // Find the matching source (usually looking for radio.mp3 in URL)
              source = source.find(src => src.listenurl && src.listenurl.includes('radio.mp3'));
            }
            
            if (source) {
              // Process title and artist
              processMetadata(source.title || 'Unknown Track');
            }
          }
        } catch (error) {
          console.error('Error processing fallback metadata:', error);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching fallback metadata:', error);
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
      
      // Try Azuracast artwork first, fallback to LastFM
      if (artist) {
        fetchAlbumArtwork(artist, title);
      }
    }
  }

  // Update metadata display with fade effect
  function updateMetadataDisplay(artist, title) {
    // Ensure we always have both title and artist displayed
    title = title || 'Unknown Track';
    artist = artist || 'itsyourradio';
    
    // Only update if the metadata has actually changed
    if (title !== state.currentMetadata.title || artist !== state.currentMetadata.artist) {
      console.log('Metadata changed, updating display');
      
      // Fade out current
      elements.trackTitle.fadeOut(300, function() {
        $(this).text(title).fadeIn(300, function() {
          checkTextOverflow();
        });
      });
      
      elements.trackArtist.fadeOut(300, function() {
        $(this).text(artist).fadeIn(300, function() {
          checkTextOverflow();
        });
      });
      
      // Update state
      state.currentMetadata.title = title;
      state.currentMetadata.artist = artist;
    } else {
      // Metadata hasn't changed, no need to update UI
      console.log('Metadata unchanged, skipping update');
    }
  }

  // Check if text needs scrolling effect
  function checkTextOverflow() {
    // We need to make sure the elements are visible before checking overflow
    elements.trackTitle.css('width', ''); // Reset width to default
    elements.trackArtist.css('width', ''); // Reset width to default
    
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

  // Fetch album artwork from the stream or LastFM API
  function fetchAlbumArtwork(artist, title) {
    if (!artist && !title) return;
    if (state.albumArtLoading) return;
    
    state.albumArtLoading = true;
    
    // Check if we can get artwork from Icecast directly
    const icecastArtUrl = `https://acast.us:8000/static/album_artwork.jpg?_=${new Date().getTime()}`;
    
    // Try to get the artwork from Icecast first
    $.ajax({
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(icecastArtUrl)}`,
      type: 'GET',
      timeout: 3000,
      success: function(data, status, xhr) {
        // Check if we actually got an image (content type)
        const contentType = xhr.getResponseHeader('content-type');
        if (contentType && contentType.startsWith('image/')) {
          updateAlbumArt(icecastArtUrl);
        } else {
          // If it's not an image, try LastFM
          tryLastFM(artist, title);
        }
      },
      error: function() {
        // If Icecast artwork fails, try LastFM
        tryLastFM(artist, title);
      }
    });
  }

  // Try LastFM API for album artwork
  function tryLastFM(artist, title) {
    // LastFM API key - this is a demo key
    const lastFmApiKey = '1f633977acf0e2d92aeae0180cc16efa';
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

  // Update album art with the URL from Azuracast
  function updateAlbumArt(artUrl) {
    if (!artUrl || state.albumArtLoading) return;
    
    // Set loading state
    state.albumArtLoading = true;
    
    const img = new Image();
    
    img.onload = function() {
      // Fade out current
      elements.albumImg.removeClass('visible');
      
      setTimeout(function() {
        // Update source and fade in
        elements.albumImg.attr('src', artUrl)
          .addClass('visible');
        
        elements.albumArt.addClass('has-art');
        
        // Extract colors and update gradient
        try {
          const colorThief = new ColorThief();
          const palette = colorThief.getPalette(img, 3);
          const colors = palette.map(color => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
          updateGradientColors(colors);
        } catch (e) {
          console.error('Error extracting colors:', e);
        }
        
        // Update state
        state.currentMetadata.artworkUrl = artUrl;
        state.albumArtLoading = false;
      }, 300);
    };
    
    img.onerror = function() {
      // Handle image loading error
      elements.albumImg.removeClass('visible');
      elements.albumArt.removeClass('has-art');
      state.albumArtLoading = false;
      
      // Try LastFM instead if we have artist and title
      if (state.currentMetadata.artist && state.currentMetadata.title) {
        fetchAlbumArtwork(state.currentMetadata.artist, state.currentMetadata.title);
      }
    };
    
    img.crossOrigin = 'Anonymous';
    img.src = artUrl;
  }

  // Update gradient colors for the player border
  function updateGradientColors(colors) {
    state.targetColors = colors;
    
    // Create or update the style for the gradient
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      #player-container::before {
        background: linear-gradient(90deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[1]}, ${colors[0]});
        background-size: 300% 100%;
        box-shadow: 0 0 20px 5px ${colors[1].replace('rgb', 'rgba').replace(')', ', 0.8)')};
        transition: background 2s ease, box-shadow 2s ease;
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