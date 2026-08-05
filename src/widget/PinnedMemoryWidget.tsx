/**
 * Android "Pinned memory" widget — a cherished feeling kept on the home
 * screen: emoji, feeling name, the note, and when it happened.
 */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { PinnedMemory } from './pinned';

export function PinnedMemoryWidget({ memory }: { memory: PinnedMemory | null }) {
  if (!memory) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: '#0b0d12',
          borderRadius: 20,
          padding: 16,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'roojifeel:///' }}
      >
        <TextWidget text="📌" style={{ fontSize: 26 }} />
        <TextWidget
          text="Pin a memory from your journal"
          style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}
        />
      </FlexWidget>
    );
  }

  const ar = memory.lang === 'ar';
  const feeling = ar ? memory.feelingAr : memory.feelingEn;
  const date = ar ? memory.dateAr : memory.dateEn;
  const title = ar ? 'ذكرى مثبتة' : 'PINNED MEMORY';

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0b0d12',
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'roojifeel:///' }}
    >
      <TextWidget
        text={`📌 ${title}`}
        style={{ fontSize: 9, color: '#a78bfa', letterSpacing: 0.1 }}
      />
      <FlexWidget
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#00000000', marginTop: 4 }}
      >
        <TextWidget text={memory.emoji} style={{ fontSize: 24 }} />
        <TextWidget
          text={feeling}
          style={{ fontSize: 17, color: '#e6e8ef', fontWeight: 'bold', marginLeft: 8 }}
        />
      </FlexWidget>
      {memory.note ? (
        <TextWidget
          text={`“${memory.note}”`}
          truncate="END"
          maxLines={2}
          style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}
        />
      ) : null}
      <TextWidget text={date} style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }} />
    </FlexWidget>
  );
}
