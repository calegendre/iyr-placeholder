import unittest
import requests
import time
import json
from PIL import Image
from io import BytesIO
import colorsys

class AzuracastAPITest(unittest.TestCase):
    """Test suite for Azuracast API integration with itsyourradio"""
    
    def setUp(self):
        """Set up test environment"""
        self.api_url = "https://acast.us/api/nowplaying/1"
        self.headers = {"X-API-Key": "your-api-key"}  # Replace with actual API key if needed
        
    def test_api_response(self):
        """Test that the Azuracast API returns a valid response"""
        response = requests.get(self.api_url, headers=self.headers)
        
        # Check status code
        self.assertEqual(response.status_code, 200, f"API request failed with status code {response.status_code}")
        
        # Check response format
        data = response.json()
        self.assertIsInstance(data, dict, "API response is not a valid JSON object")
        
        # Check required fields
        self.assertIn("station", data, "Response missing 'station' field")
        self.assertIn("now_playing", data, "Response missing 'now_playing' field")
        self.assertIn("song", data["now_playing"], "Response missing 'song' in 'now_playing'")
        
        # Print current song info
        song = data["now_playing"]["song"]
        print(f"Current song: {song.get('artist', 'Unknown')} - {song.get('title', 'Unknown')}")
        
        return data
    
    def test_album_art(self):
        """Test album artwork retrieval and processing"""
        # Get current song data
        data = self.test_api_response()
        
        # Check for album art URL
        song = data["now_playing"]["song"]
        self.assertIn("art", song, "Response missing 'art' in song data")
        
        art_url = song["art"]
        print(f"Album art URL: {art_url}")
        
        # Verify album art URL format
        self.assertTrue(art_url.startswith("https://acast.us/api/station/"), 
                        "Album art URL does not match expected format")
        
        # Try to download the image
        response = requests.get(art_url)
        self.assertEqual(response.status_code, 200, "Failed to download album art")
        
        # Verify it's a valid image
        try:
            image = Image.open(BytesIO(response.content))
            width, height = image.size
            print(f"Album art dimensions: {width}x{height}")
            self.assertTrue(width > 0 and height > 0, "Invalid image dimensions")
            
            # Test color extraction (similar to what the frontend would do)
            colors = self.extract_colors(image)
            print(f"Extracted colors: {colors}")
            self.assertTrue(len(colors) > 0, "Failed to extract colors from album art")
            
        except Exception as e:
            self.fail(f"Failed to process album art: {str(e)}")
    
    def test_metadata_updates(self):
        """Test that metadata updates over time"""
        # Get initial data
        initial_data = self.test_api_response()
        initial_title = initial_data["now_playing"]["song"]["title"]
        print(f"Current stream title: {initial_title}")
        
        # Record timestamp
        first_timestamp = time.time()
        print(f"First request timestamp: {int(first_timestamp)}")
        
        # Wait a short time and make another request
        time.sleep(5)
        
        # Get updated data
        updated_data = self.test_api_response()
        
        # Record second timestamp
        second_timestamp = time.time()
        print(f"Second request timestamp: {int(second_timestamp)}")
        
        # Verify the elapsed time
        elapsed = second_timestamp - first_timestamp
        self.assertTrue(elapsed >= 4, f"Second request too soon ({elapsed:.2f}s), should be at least 4s")
        
        # Note: We don't assert that the title changed, as it might be the same song
        # But we verify that we can make multiple requests successfully
    
    def extract_colors(self, image, num_colors=3):
        """Extract dominant colors from an image (similar to frontend logic)"""
        # Resize image for faster processing
        image = image.resize((50, 50))
        
        # Convert to RGB if needed
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        # Get pixel data
        pixels = list(image.getdata())
        
        # Simple color counting (not as sophisticated as frontend might use)
        color_count = {}
        for pixel in pixels:
            if pixel in color_count:
                color_count[pixel] += 1
            else:
                color_count[pixel] = 1
        
        # Sort by frequency
        sorted_colors = sorted(color_count.items(), key=lambda x: x[1], reverse=True)
        
        # Convert to hex format
        hex_colors = [f"#{r:02x}{g:02x}{b:02x}" for (r, g, b), _ in sorted_colors[:num_colors]]
        return hex_colors

if __name__ == "__main__":
    unittest.main(verbosity=2)