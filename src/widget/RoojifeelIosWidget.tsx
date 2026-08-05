/**
 * iOS home-screen widget (expo-widgets, SDK 57+).
 * Shows today's check-in count and dominant feeling; tapping opens the app.
 * The layout is compiled to SwiftUI via the 'widget' directive — this
 * component runs in the widget extension, not the app runtime.
 */
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type RoojifeelWidgetProps = {
  todayCount: number;
  emoji: string;
  feeling: string;
  prompt: string;
};

const PURPLE = '#a78bfa';
const INK = '#e6e8ef';
const INK_SOFT = '#9ca3af';

const RoojifeelWidgetView = (props: RoojifeelWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const hasMood = props.todayCount > 0 && props.feeling !== '';

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle(INK_SOFT)]}>
          ROOJIFEEL
        </Text>
        <Spacer />
        {hasMood ? (
          <VStack>
            <Text modifiers={[font({ size: 30 })]}>{props.emoji}</Text>
            <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(INK)]}>
              {props.feeling}
            </Text>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(INK_SOFT)]}>
              ×{props.todayCount} today
            </Text>
          </VStack>
        ) : (
          <VStack>
            <Text modifiers={[font({ size: 26 })]}>💭</Text>
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(INK)]}>
              How do you feel?
            </Text>
          </VStack>
        )}
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(PURPLE)]}>
          + Log a feeling
        </Text>
      </VStack>
    );
  }

  // systemMedium
  return (
    <HStack modifiers={[padding({ all: 12 })]}>
      <VStack>
        <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle(INK_SOFT)]}>
          TODAY'S FEELINGS
        </Text>
        {hasMood ? (
          <HStack>
            <Text modifiers={[font({ size: 32 })]}>{props.emoji}</Text>
            <VStack>
              <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(INK)]}>
                {props.feeling}
              </Text>
              <Text modifiers={[font({ size: 11 }), foregroundStyle(INK_SOFT)]}>
                ×{props.todayCount} check-ins
              </Text>
            </VStack>
          </HStack>
        ) : (
          <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(INK)]}>
            {props.prompt !== '' ? props.prompt : 'What are you feeling right now?'}
          </Text>
        )}
      </VStack>
      <Spacer />
      <VStack>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(PURPLE)]}>
          + Log
        </Text>
      </VStack>
    </HStack>
  );
};

export const RoojifeelIosWidget = createWidget('RoojifeelWidget', RoojifeelWidgetView);
