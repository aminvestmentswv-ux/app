import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { styles } from './styles';

const instructions = [
  {
    title: 'iPhone · Safari',
    steps: [
      'Open app.aminvestmentswv.com in Safari.',
      'Tap Share (the square with an upward arrow).',
      'Choose Add to Home Screen. You may need to scroll down.',
      'Name it AM Investments, then tap Add.',
    ],
  },
  {
    title: 'Android · Chrome',
    steps: [
      'Open app.aminvestmentswv.com in Chrome.',
      'Tap the three-dot menu (⋮).',
      'Choose Add to Home screen or Install app, if offered.',
      'Follow the prompts to add AM Investments.',
    ],
  },
];

export function HomeScreenGuide() {
  const [expanded, setExpanded] = useState(false);
  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.homeScreenSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save to your Home Screen"
        accessibilityState={{ expanded }}
        aria-controls="home-screen-steps"
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.homeScreenToggle, pressed && styles.pressed]}
      >
        <Text accessibilityRole="header" style={styles.homeScreenTitle}>Save to your Home Screen</Text>
        <Text style={styles.description}>Keep AM Investments one tap away.</Text>
        <Text style={styles.homeScreenAction}>{expanded ? 'Hide steps  −' : 'Show steps  +'}</Text>
      </Pressable>
      {expanded ? (
        <View nativeID="home-screen-steps" style={styles.homeScreenInstructions}>
          {instructions.map(({ title, steps }) => (
            <View key={title} style={styles.homeScreenDevice}>
              <Text accessibilityRole="header" style={styles.shareTitle}>{title}</Text>
              {steps.map((step, index) => (
                <Text key={step} style={styles.homeScreenStep}>{index + 1}. {step}</Text>
              ))}
            </View>
          ))}
          <Text style={styles.homeScreenHint}>Opened from Facebook or another app? Open this page in Safari or Chrome first. Once added, tap the AM Investments icon on your Home Screen to return here.</Text>
        </View>
      ) : null}
    </View>
  );
}
