/**
 * iOS "Pinned memory" widget (expo-widgets) — a cherished feeling kept on
 * the home screen: emoji, feeling name, note, and when it happened.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type PinnedWidgetProps = {
  emoji: string;
  feeling: string;
  note: string;
  date: string;
  title: string;
  emptyText: string;
  hasPin: boolean;
};

const PURPLE = '#a78bfa';
const INK = '#e6e8ef';
const INK_SOFT = '#9ca3af';
const INK_FAINT = '#6b7280';

const PinnedWidgetView = (props: PinnedWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  if (!props.hasPin) {
    return (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Spacer />
        <Text modifiers={[font({ size: 24 })]}>📌</Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(INK_SOFT)]}>{props.emptyText}</Text>
        <Spacer />
      </VStack>
    );
  }

  const small = environment.widgetFamily === 'systemSmall';

  return (
    <VStack modifiers={[padding({ all: small ? 10 : 12 })]}>
      <HStack>
        <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle(PURPLE)]}>
          {`📌 ${props.title}`}
        </Text>
        <Spacer />
      </HStack>
      <Spacer />
      <HStack>
        <Text modifiers={[font({ size: small ? 20 : 24 })]}>{props.emoji}</Text>
        <Text
          modifiers={[font({ size: small ? 14 : 17, weight: 'bold' }), foregroundStyle(INK)]}
        >
          {props.feeling}
        </Text>
        <Spacer />
      </HStack>
      {props.note !== '' && !small ? (
        <HStack>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(INK_SOFT)]}>
            {`“${props.note}”`}
          </Text>
          <Spacer />
        </HStack>
      ) : null}
      <Spacer />
      <HStack>
        <Text modifiers={[font({ size: 9 }), foregroundStyle(INK_FAINT)]}>{props.date}</Text>
        <Spacer />
      </HStack>
    </VStack>
  );
};

export const RoojifeelPinnedIosWidget = createWidget('RoojifeelPinnedWidget', PinnedWidgetView);
