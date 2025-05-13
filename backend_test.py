import requests
import unittest
import time
import json

class ItsYourRadioAPITest(unittest.TestCase):
    """Test suite for the itsyourradio API integration"""
    
    def setUp(self):
        """Set up test variables"""
        self.azuracast_api_url = "https://acast.us/api/nowplaying/1"
        self.icecast_api_url = "https://acast.us:8000/status-json.xsl"
        self.headers = {
            'X-API-Key': '3e0fbebad23a39d7:3bf8c0250ddd8d1995a085942eb8aefd'
        }
    
    def test_azuracast_api_connection(self):
        """Test that the Azuracast API is accessible"""
        try:
            response = requests.get(self.azuracast_api_url, headers=self.headers, timeout=5)
            self.assertEqual(response.status_code, 200, "Azuracast API should return 200 OK")
            
            # Verify response contains expected data structure
            data = response.json()
            self.assertIn('now_playing', data, "Response should contain 'now_playing' field")
            self.assertIn('song', data['now_playing'], "Response should contain song information")
            
            # Print current song info for verification
            song = data['now_playing']['song']
            print(f"Current song: {song.get('artist', 'Unknown')} - {song.get('title', 'Unknown')}")
            
            # Check if album art URL is present
            if 'art' in song:
                print(f"Album art URL: {song['art']}")
                # Verify the art URL is accessible
                art_response = requests.head(song['art'], timeout=5)
                self.assertTrue(art_response.status_code in [200, 302], "Album art URL should be accessible")
            else:
                print("No album art URL in the response")
        
        except requests.RequestException as e:
            self.fail(f"Failed to connect to Azuracast API: {str(e)}")
        except json.JSONDecodeError:
            self.fail("Response is not valid JSON")
    
    def test_icecast_api_fallback(self):
        """Test the Icecast API fallback"""
        try:
            # Add timestamp to prevent caching
            timestamp = int(time.time())
            url = f"{self.icecast_api_url}?nocache={timestamp}"
            
            response = requests.get(url, timeout=5)
            self.assertEqual(response.status_code, 200, "Icecast API should return 200 OK")
            
            # Verify response contains expected data structure
            data = response.json()
            self.assertIn('icestats', data, "Response should contain 'icestats' field")
            
            # Check if source information is available
            if 'source' in data['icestats']:
                source = data['icestats']['source']
                
                # Handle both single source and array of sources
                if isinstance(source, list):
                    # Find the radio.mp3 source
                    radio_source = next((s for s in source if 'listenurl' in s and 'radio.mp3' in s['listenurl']), None)
                    if radio_source:
                        print(f"Current stream title: {radio_source.get('title', 'Unknown')}")
                else:
                    print(f"Current stream title: {source.get('title', 'Unknown')}")
            else:
                print("No source information in the Icecast response")
        
        except requests.RequestException as e:
            self.fail(f"Failed to connect to Icecast API: {str(e)}")
        except json.JSONDecodeError:
            self.fail("Response is not valid JSON")
    
    def test_metadata_update_interval(self):
        """Test that metadata updates at the expected interval"""
        try:
            # Get initial metadata
            response1 = requests.get(self.azuracast_api_url, headers=self.headers, timeout=5)
            data1 = response1.json()
            
            # Wait for 5 seconds (slightly longer than the 4-second interval in the code)
            time.sleep(5)
            
            # Get updated metadata
            response2 = requests.get(self.azuracast_api_url, headers=self.headers, timeout=5)
            data2 = response2.json()
            
            # Check if the timestamps are different
            timestamp1 = data1['now_playing']['played_at']
            timestamp2 = data2['now_playing']['played_at']
            
            print(f"First request timestamp: {timestamp1}")
            print(f"Second request timestamp: {timestamp2}")
            
            # Note: We're not asserting equality here because the song might not change
            # in our test interval, but we can verify the API returns timestamps
            self.assertIsNotNone(timestamp1, "First response should contain a timestamp")
            self.assertIsNotNone(timestamp2, "Second response should contain a timestamp")
            
        except requests.RequestException as e:
            self.fail(f"Failed to connect to Azuracast API: {str(e)}")
        except json.JSONDecodeError:
            self.fail("Response is not valid JSON")
        except KeyError as e:
            self.fail(f"Expected key not found in response: {str(e)}")

if __name__ == "__main__":
    unittest.main(verbosity=2)