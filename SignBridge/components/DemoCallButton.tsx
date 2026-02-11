import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';

interface Props {
  onTranscriptUpdate: (text: string) => void;
}

export default function DemoCallButton({ onTranscriptUpdate }: Props) {
  const [mode, setMode] = useState<'idle' | 'live' | 'recorded'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);

  const startLiveDemo = () => {
    setMode('live');
    setIsProcessing(true);
    
    const phrases = [
      "Hello, this is Morgan",
      "Thank you for calling",
      "Yes I can help with that",
      "No problem at all",
      "Please hold for a moment"
    ];
    
    let phraseIndex = 0;
    
    // Send a new phrase every 2 seconds
    const interval = setInterval(() => {
      if (phraseIndex >= phrases.length) {
        clearInterval(interval);
        setIsProcessing(false);
        return;
      }
      
      const phrase = phrases[phraseIndex];
      console.log(`🎤 LIVE CALL: "${phrase}"`);
      
      // Type it out character by character for effect
      let charIndex = 0;
      const typingInterval = setInterval(() => {
        onTranscriptUpdate(phrase.substring(0, charIndex + 1));
        charIndex++;
        
        if (charIndex === phrase.length) {
          clearInterval(typingInterval);
        }
      }, 50);
      
      phraseIndex++;
    }, 2500);
  };

  const startRecordedDemo = async () => {
    setMode('recorded');
    setIsProcessing(true);
    
    // Show "processing" state
    onTranscriptUpdate("📞 Retrieving voicemail recording...");
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Play the actual audio (using TTS to simulate a real recording)
    await Speech.speak("Hello, this is a recorded message. Please call me back when you get this.", {
      onDone: () => {
        // Show the transcription after audio finishes
        onTranscriptUpdate(
          "🎧 [VOICEMAIL] Hello, this is a recorded message. Please call me back when you get this."
        );
        setIsProcessing(false);
        setMode('idle');
      }
    });
  };

  const handlePress = () => {
    if (mode === 'live') {
      // Stop live demo
      setMode('idle');
      onTranscriptUpdate('');
    } else {
      // Cycle through demo modes
      if (mode === 'idle') {
        startLiveDemo();
      }
    }
  };

  const handleLongPress = () => {
    startRecordedDemo();
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.button,
          mode === 'live' && styles.buttonLive,
          mode === 'recorded' && styles.buttonRecorded
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
      >
        {isProcessing ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text style={styles.icon}>
              {mode === 'live' ? '🎤' : mode === 'recorded' ? '📼' : '📞'}
            </Text>
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                {mode === 'live' 
                  ? 'Live Call in Progress...' 
                  : mode === 'recorded'
                    ? 'Playing Voicemail...'
                    : 'Demo Call'
                }
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'idle' && 'Tap for live • Hold for recording'}
                {mode === 'live' && 'Tap to stop'}
                {mode === 'recorded' && 'Playing recorded message...'}
              </Text>
            </View>
          </>
        )}
      </Pressable>
      
      {mode === 'live' && (
        <View style={styles.liveIndicator}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveText}>LIVE • Real-time transcription</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2f7bff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 40,
    gap: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonLive: {
    backgroundColor: '#dc2626',
  },
  buttonRecorded: {
    backgroundColor: '#7c3aed',
  },
  icon: {
    fontSize: 24,
    color: 'white',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  liveText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
});