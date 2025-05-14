/**
 * IYR Player Bar - A stunning responsive audio player with dynamic color themes
 * Version: 1.0
 * Author: itsyourradio
 * 
 * Dependencies:
 * - jQuery
 * - jPlayer
 * - ColorThief
 */

(function($) {
  'use strict';
  
  // Namespace
  window.IYRPlayer = window.IYRPlayer || {};
  
  /**
   * Initialize the player with configuration
   * @param {Object} options - Configuration options
   */
  IYRPlayer.init = function(options) {
    // Default configuration
    const defaultConfig = {
      selector: '#jquery_jplayer_1',
      containerSelector: '#player-container',
      streams: {
        mp3: 'https://example.com/stream.mp3',
        aacp: 'https://example.com/stream.aacp',
        m3u: 'https://example.com/playlist.m3u',
        pls: 'https://example.com/playlist.pls'
      },
      metadataUrl: 'https://example.com/api/nowplaying/1',
      metadataApiKey: null,
      metadataInterval: 4000, // 4 seconds
      artworkFadeTime: 300, // ms
      volume: 0.7, // Default volume (0-1)
      autoplay: false,
      defaultColors: ['#c3deeb', '#8a6389', '#2e4e7e'],
      lastFmAPIKey: null
    };
    
    // Merge default config with user options
    this.config = $.extend(true, {}, defaultConfig, options);
    
    // Initialize state
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentMetadata: {
        title: '',
        artist: '',
        artworkUrl: ''
      },
      metadataTimer: null,
      lastColors: [...this.config.defaultColors],
      targetColors: [...this.config.defaultColors],
      colorTransitionInProgress: false,
      albumArtLoading: false,
      messageTimeout: null,
      failCount: 0  // Count of attempts to play different stream formats
    };
    
    // Initialize player elements
    this.elements = {
      player: $(this.config.selector),
      container: $(this.config.containerSelector),
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
    
    // Initialize UI state
    this.elements.stopBtn.addClass('disabled'); // Initially disable stop button
    
    // Set up jPlayer
    this._setupJPlayer();
    
    // Attach event handlers
    this._attachEvents();
    
    // Initialize gradient colors
    this.updateGradientColors(this.config.defaultColors);
    
    return this;
  };
  
  /**
   * Set up jPlayer with configuration
   * @private
   */
  IYRPlayer._setupJPlayer = function() {
    const self = this;
    
    this.elements.player.jPlayer({
      ready: function() {
        console.log('jPlayer ready');
        if (self.config.autoplay) {
          self.play();
        }
      },
      supplied: 'mp3, aacp', // Support multiple formats
      solution: 'html, flash',  // Try HTML5 first, then Flash if needed
      wmode: 'window',
      preload: 'metadata',
      volume: this.config.volume,
      cssSelectorAncestor: '#jp_container_1',
      useStateClassSkin: true,
      autoBlur: false,
      smoothPlayBar: true,
      keyEnabled: true,
      remainingDuration: false,
      toggleDuration: false,
      play: function() {
        self.state.isPlaying = true;
        self.state.isPaused = false;
        self.updatePlayPauseUI();
        
        // Add animation class to container
        self.elements.container.addClass('active');
        
        // Start fetching metadata
        self.fetchMetadata();
      },
      pause: function() {
        self.updatePlayPauseUI();
      },
      stop: function() {
        self.elements.loadingIndicator.removeClass('visible');
        self.elements.container.removeClass('active');
      },
      error: function(event) {
        const error = event.jPlayer.error;
        console.log('jPlayer error:', error.message);
        
        // Increment fail count
        self.state.failCount++;
        
        // Show error message
        self.showMessage(`Error: ${error.message}`, 'error');
        
        // Try fallback stream if available
        self.tryFallbackStream();
      }
    });
  };
  
  /**
   * Attach event handlers to player elements
   * @private
   */
  IYRPlayer._attachEvents = function() {
    const self = this;
    
    // Play/Pause button
    this.elements.playPauseBtn.on('click', function() {
      self.togglePlayPause();
    });
    
    // Stop button
    this.elements.stopBtn.on('click', function() {
      self.stop();
    });
    
    // Volume bar
    this.elements.volumeBar.on('click', function(e) {
      self.adjustVolume(e, this);
    });
  };
  
  /**
   * Adjust volume on click
   * @param {Event} e - Click event
   * @param {Element} element - Volume bar element
   */
  IYRPlayer.adjustVolume = function(e, element) {
    const offset = $(element).offset();
    const x = e.pageX - offset.left;
    const width = $(element).width();
    const percentage = x / width;
    
    // Set the value visually
    this.elements.volumeBarValue.width(percentage * 100 + '%');
    
    // Set the volume
    this.elements.player.jPlayer('volume', percentage);
  };
  
  /**
   * Start playback
   */
  IYRPlayer.play = function() {
    if (this.state.isPlaying && !this.state.isPaused) return;
    
    if (this.state.isPaused) {
      this.resume();
      return;
    }
    
    this.elements.loadingIndicator.addClass('visible');
    
    try {
      // Set the stream URL with multiple formats for fallback
      this.elements.player.jPlayer('setMedia', {
        mp3: this.config.streams.mp3,
        aacp: this.config.streams.aacp
      });
      
      // Start playback
      this.elements.player.jPlayer('play');
    } catch(e) {
      console.error('Error starting playback:', e);
      this.showMessage('Error starting playback', 'error');
      this.elements.loadingIndicator.removeClass('visible');
    }
  };
  
  /**
   * Pause playback
   */
  IYRPlayer.pause = function() {
    if (!this.state.isPlaying) return;
    
    this.elements.player.jPlayer('pause');
    this.state.isPaused = true;
    this.updatePlayPauseUI();
    
    // We don't remove the active class so the border animation continues
  };
  
  /**
   * Resume playback
   */
  IYRPlayer.resume = function() {
    if (!this.state.isPaused) return;
    
    this.elements.player.jPlayer('play');
    this.state.isPaused = false;
    this.state.isPlaying = true;
    this.updatePlayPauseUI();
  };
  
  /**
   * Toggle play/pause
   */
  IYRPlayer.togglePlayPause = function() {
    if (!this.state.isPlaying && !this.state.isPaused) {
      this.play();
    } else if (this.state.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  };
  
  /**
   * Stop playback
   */
  IYRPlayer.stop = function() {
    this.elements.player.jPlayer('stop');
    this.resetMetadataDisplay();
    clearTimeout(this.state.metadataTimer);
    this.state.metadataTimer = null;
    this.state.isPlaying = false;
    this.state.isPaused = false;
    
    // Reset colors to default
    this.updateGradientColors(this.config.defaultColors);
    
    // Remove animation class
    this.elements.container.removeClass('active');
    
    // Disable stop button
    this.updateButtonStates();
  };
  
  /**
   * Reset metadata display
   */
  IYRPlayer.resetMetadataDisplay = function() {
    // Reset the display
    this.elements.trackTitle.text('');
    this.elements.trackArtist.text('');
    this.elements.albumImg.removeClass('visible').attr('src', '');
    this.elements.albumArt.removeClass('has-art');
    
    // Reset state
    this.state.currentMetadata = {
      title: '',
      artist: '',
      artworkUrl: ''
    };
  };
  
  /**
   * Try fallback stream URLs when main stream fails
   */
  IYRPlayer.tryFallbackStream = function() {
    // Check if we have any fallback options
    if (this.config.streams.m3u || this.config.streams.pls || this.config.streams.aacp) {
      this.showMessage('Trying backup stream...', 'info');
      
      // If main stream failed, try the alternative streams
      if (this.state.failCount === 1) {
        console.log('Trying aacp stream');
      } else if (this.state.failCount === 2) {
        console.log('Trying m3u playlist');
        // Now try the m3u playlist
        this.config.streams.mp3 = this.config.streams.m3u;
      } else if (this.state.failCount === 3) {
        console.log('Trying pls playlist');
        // Finally try the pls playlist
        this.config.streams.mp3 = this.config.streams.pls;
      } else {
        // If we've tried all formats, reset the counter
        console.log('All stream formats tried, resetting');
        this.state.failCount = 0;
        this.elements.loadingIndicator.removeClass('visible');
        return;
      }
      
      // Try to play again
      this.elements.player.jPlayer('setMedia', {
        mp3: this.config.streams.mp3,
        aacp: this.config.streams.aacp
      });
      
      this.elements.player.jPlayer('play');
    } else {
      this.elements.loadingIndicator.removeClass('visible');
    }
  };
  
  /**
   * Fetch metadata from Azuracast API
   */
  IYRPlayer.fetchMetadata = function() {
    const self = this;
    
    // Clear any existing timer
    clearTimeout(this.state.metadataTimer);
    
    // Don't fetch metadata if not playing
    if (!this.state.isPlaying) return;
    
    const apiHeaders = {};
    if (this.config.metadataApiKey) {
      apiHeaders['X-API-Key'] = this.config.metadataApiKey;
    }
    
    // Get the metadata from Azuracast API
    $.ajax({
      url: this.config.metadataUrl,
      dataType: 'json',
      timeout: 5000, // 5 second timeout
      headers: apiHeaders,
      success: function(data) {
        try {
          if (data && data.now_playing) {
            const nowPlaying = data.now_playing;
            const song = nowPlaying.song || {};
            
            // Get title and artist
            const title = song.title || 'Unknown Track';
            const artist = song.artist || '';
            
            // Process title and artist
            self.updateMetadataDisplay(artist, title);
            
            // Get album art
            if (song.art) {
              self.updateAlbumArt(song.art);
            } else {
              // Fallback to LastFM if no art is provided
              self.fetchAlbumArtwork(artist, title);
            }
          }
        } catch (error) {
          console.error('Error processing Azuracast metadata:', error);
          // Fallback to old method
          self.tryFallbackMetadata();
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching Azuracast metadata:', error);
        // Fallback to old method
        self.tryFallbackMetadata();
      },
      complete: function() {
        // Schedule next update if we're still playing
        if (self.state.isPlaying) {
          self.state.metadataTimer = setTimeout(function() {
            self.fetchMetadata();
          }, self.config.metadataInterval);
        }
      }
    });
  };
  
  /**
   * Try fallback metadata fetching method
   */
  IYRPlayer.tryFallbackMetadata = function() {
    const self = this;
    
    // Default values if all fails
    self.updateMetadataDisplay('itsyourradio', 'Live Stream');
  };
  
  /**
   * Update metadata display
   * @param {string} artist - Artist name
   * @param {string} title - Track title
   */
  IYRPlayer.updateMetadataDisplay = function(artist, title) {
    // Ensure we always have both title and artist displayed
    title = title || 'Unknown Track';
    artist = artist || 'itsyourradio';
    
    // Only update if the metadata has actually changed
    if (title !== this.state.currentMetadata.title || artist !== this.state.currentMetadata.artist) {
      console.log('Metadata changed, updating display');
      
      // Fade out current
      this.elements.trackTitle.fadeOut(300, () => {
        this.elements.trackTitle.text(title).fadeIn(300, () => {
          this.checkTextOverflow(this.elements.trackTitle);
        });
      });
      
      this.elements.trackArtist.fadeOut(300, () => {
        this.elements.trackArtist.text(artist).fadeIn(300, () => {
          this.checkTextOverflow(this.elements.trackArtist);
        });
      });
      
      // Update state
      this.state.currentMetadata.title = title;
      this.state.currentMetadata.artist = artist;
    } else {
      // Metadata hasn't changed, no need to update UI
      console.log('Metadata unchanged, skipping update');
    }
  };
  
  /**
   * Check if text overflows and add scrolling if needed
   * @param {jQuery} element - Text element to check
   */
  IYRPlayer.checkTextOverflow = function(element) {
    const containerWidth = element.width();
    const textWidth = element[0].scrollWidth;
    
    if (textWidth > containerWidth) {
      element.addClass('scrolling');
    } else {
      element.removeClass('scrolling');
    }
  };
  
  /**
   * Fetch album artwork from Last.fm
   * @param {string} artist - Artist name
   * @param {string} title - Track title
   */
  IYRPlayer.fetchAlbumArtwork = function(artist, title) {
    // Skip if no LastFM API key
    if (!this.config.lastFmAPIKey) return;
    
    const self = this;
    
    // Skip if artist and title are missing
    if (!artist || !title) return;
    
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${this.config.lastFmAPIKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`;
    
    $.ajax({
      url: url,
      dataType: 'json',
      timeout: 5000,
      success: function(data) {
        try {
          if (data && data.track && data.track.album && data.track.album.image) {
            const images = data.track.album.image;
            const largeImage = images.find(img => img.size === 'large' || img.size === 'extralarge');
            
            if (largeImage && largeImage['#text']) {
              self.updateAlbumArt(largeImage['#text']);
            } else {
              self.tryItunesFallback(artist, title);
            }
          } else {
            self.tryItunesFallback(artist, title);
          }
        } catch (e) {
          console.error('Error processing Last.fm data:', e);
          self.tryItunesFallback(artist, title);
        }
      },
      error: function() {
        console.log('Error fetching Last.fm artwork, trying iTunes');
        self.tryItunesFallback(artist, title);
      }
    });
  };
  
  /**
   * Try to get artwork from iTunes as a fallback
   * @param {string} artist - Artist name
   * @param {string} title - Track title
   */
  IYRPlayer.tryItunesFallback = function(artist, title) {
    const self = this;
    const term = `${artist} ${title}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=1`;
    
    $.ajax({
      url: url,
      dataType: 'jsonp',
      timeout: 5000,
      success: function(data) {
        if (data && data.results && data.results.length > 0) {
          const artworkUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
          self.updateAlbumArt(artworkUrl);
        }
      }
    });
  };
  
  /**
   * Update album art with the URL
   * @param {string} artUrl - URL of the album artwork
   */
  IYRPlayer.updateAlbumArt = function(artUrl) {
    if (!artUrl || this.state.albumArtLoading) return;
    
    // Only update if the artwork has actually changed
    if (artUrl === this.state.currentMetadata.artworkUrl) {
      console.log('Artwork unchanged, skipping update');
      return;
    }
    
    console.log('Artwork changed, updating display');
    
    // Set loading state
    this.state.albumArtLoading = true;
    
    const self = this;
    const img = new Image();
    
    img.onload = function() {
      // Fade out current
      self.elements.albumImg.removeClass('visible');
      
      setTimeout(function() {
        // Update source and fade in
        self.elements.albumImg.attr('src', artUrl)
          .addClass('visible');
        
        self.elements.albumArt.addClass('has-art');
        
        // Extract colors and update gradient
        try {
          const colorThief = new ColorThief();
          const palette = colorThief.getPalette(img, 3);
          const colors = palette.map(color => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
          self.updateGradientColors(colors);
        } catch (e) {
          console.error('Error extracting colors:', e);
        }
        
        // Update state
        self.state.currentMetadata.artworkUrl = artUrl;
        self.state.albumArtLoading = false;
      }, self.config.artworkFadeTime);
    };
    
    img.onerror = function() {
      // Handle image loading error
      self.elements.albumImg.removeClass('visible');
      self.elements.albumArt.removeClass('has-art');
      self.state.albumArtLoading = false;
      
      // Try LastFM instead if we have artist and title
      if (self.state.currentMetadata.artist && self.state.currentMetadata.title) {
        self.fetchAlbumArtwork(self.state.currentMetadata.artist, self.state.currentMetadata.title);
      }
    };
    
    img.crossOrigin = 'Anonymous';
    img.src = artUrl;
  };
  
  /**
   * Update gradient colors for the player border
   * @param {Array} colors - Array of RGB color strings
   */
  IYRPlayer.updateGradientColors = function(colors) {
    this.state.targetColors = colors;
    
    // Create or update the style for the gradient
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      #player-container::before {
        background: linear-gradient(90deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[1]}, ${colors[0]});
        background-size: 300% 100%;
        box-shadow: 0 0 20px 5px ${colors[1].replace('rgb', 'rgba').replace(')', ', 0.8)')};
        transition: background 2s ease, box-shadow 2s ease;
      }
      
      .jp-volume-bar-value {
        background: linear-gradient(90deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[1]}, ${colors[0]});
        background-size: 300% 100%;
      }
      
      .jp-volume-bar::before {
        background: linear-gradient(90deg, ${colors[0]}40, ${colors[1]}40, ${colors[2]}40, ${colors[1]}40, ${colors[0]}40);
        background-size: 300% 100%;
      }
    `;
    
    // Replace existing style if it exists, otherwise append
    const existingStyle = document.getElementById('gradientStyle');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    styleTag.id = 'gradientStyle';
    document.head.appendChild(styleTag);
  };
  
  /**
   * Update play/pause UI
   */
  IYRPlayer.updatePlayPauseUI = function() {
    if (this.state.isPlaying && !this.state.isPaused) {
      this.elements.playIcon.hide();
      this.elements.pauseIcon.show();
      this.elements.loadingIndicator.removeClass('visible');
    } else {
      this.elements.playIcon.show();
      this.elements.pauseIcon.hide();
    }
    
    // Update stop button state
    this.updateButtonStates();
  };
  
  /**
   * Update button states based on playback state
   */
  IYRPlayer.updateButtonStates = function() {
    // Enable/disable stop button based on playback state
    if (this.state.isPlaying || this.state.isPaused) {
      this.elements.stopBtn.removeClass('disabled');
    } else {
      this.elements.stopBtn.addClass('disabled');
    }
  };
  
  /**
   * Show message overlay
   * @param {string} message - Message to display
   * @param {string} type - Message type (error, success, info)
   */
  IYRPlayer.showMessage = function(message, type) {
    // Clear any existing timeout
    if (this.state.messageTimeout) {
      clearTimeout(this.state.messageTimeout);
    }
    
    // Update message and show
    this.elements.messageOverlay
      .removeClass('error success info')
      .addClass(type)
      .text(message)
      .addClass('visible');
    
    // Hide after 3 seconds
    const self = this;
    this.state.messageTimeout = setTimeout(function() {
      self.elements.messageOverlay.removeClass('visible');
    }, 3000);
  };
  
})(jQuery);