/**
 * Roojifeel — Feelings Wheel data model.
 *
 * A 3-level tree mirroring the classic feelings wheel:
 *   core (center ring) → secondary (middle ring) → tertiary (outer ring).
 * Colors are sampled from the wheel artwork so every feeling renders in
 * its authentic hue. Each core provides three shades (core / mid / outer)
 * matching the wheel's ring gradients.
 */

export interface FeelingNode {
  id: string;
  en: string;
  ar: string;
  children?: FeelingNode[];
}

export interface CoreFeeling extends FeelingNode {
  /** Center-ring color (most saturated). */
  color: string;
  /** Middle-ring color. */
  colorMid: string;
  /** Outer-ring color (lightest). */
  colorOuter: string;
  /** Soft tint for card backgrounds. */
  tint: string;
  emoji: string;
  children: FeelingNode[];
}

const n = (id: string, en: string, ar: string, children?: FeelingNode[]): FeelingNode => ({
  id,
  en,
  ar,
  children,
});

export const FEELINGS_WHEEL: CoreFeeling[] = [
  {
    id: 'happy',
    en: 'Happy',
    ar: 'سعيد',
    color: '#EF8D22',
    colorMid: '#F09A2F',
    colorOuter: '#F2A93B',
    tint: 'rgba(239, 141, 34, 0.13)',
    emoji: '😊',
    children: [
      n('playful', 'Playful', 'مرِح', [
        n('aroused', 'Aroused', 'متحمس عاطفياً'),
        n('cheeky', 'Cheeky', 'شقي'),
      ]),
      n('content', 'Content', 'راضٍ', [
        n('free', 'Free', 'حر'),
        n('joyful', 'Joyful', 'مبتهج'),
      ]),
      n('interested', 'Interested', 'مهتم', [
        n('curious', 'Curious', 'فضولي'),
        n('inquisitive', 'Inquisitive', 'متسائل'),
      ]),
      n('proud', 'Proud', 'فخور', [
        n('successful', 'Successful', 'ناجح'),
        n('confident', 'Confident', 'واثق'),
      ]),
      n('accepted', 'Accepted', 'مقبول', [
        n('respected', 'Respected', 'محترم'),
        n('valued', 'Valued', 'مقدَّر'),
      ]),
      n('powerful', 'Powerful', 'قوي', [
        n('courageous', 'Courageous', 'شجاع'),
        n('creative', 'Creative', 'مبدع'),
      ]),
      n('peaceful', 'Peaceful', 'مطمئن', [
        n('loving', 'Loving', 'محب'),
        n('thankful', 'Thankful', 'ممتن'),
      ]),
      n('trusting', 'Trusting', 'واثق بالآخرين', [
        n('sensitive', 'Sensitive', 'مرهف الحس'),
        n('intimate', 'Intimate', 'حميمي'),
      ]),
      n('optimistic', 'Optimistic', 'متفائل', [
        n('hopeful', 'Hopeful', 'مفعم بالأمل'),
        n('inspired', 'Inspired', 'ملهَم'),
      ]),
    ],
  },
  {
    id: 'surprised',
    en: 'Surprised',
    ar: 'متفاجئ',
    color: '#4f9273',
    colorMid: '#5fa583',
    colorOuter: '#6fa38a',
    tint: 'rgba(83, 127, 98, 0.16)',
    emoji: '😲',
    children: [
      n('startled', 'Startled', 'مذهول', [
        n('shocked', 'Shocked', 'مصدوم'),
        n('dismayed', 'Dismayed', 'مرتاع'),
      ]),
      n('confused', 'Confused', 'مرتبك', [
        n('disillusioned', 'Disillusioned', 'خائب الظن'),
        n('perplexed', 'Perplexed', 'محتار'),
      ]),
      n('amazed', 'Amazed', 'مندهش', [
        n('astonished', 'Astonished', 'مبهور'),
        n('awe', 'Awe', 'مأخوذ بالرهبة'),
      ]),
      n('excited', 'Excited', 'متحمس', [
        n('eager', 'Eager', 'متلهف'),
        n('energetic', 'Energetic', 'مفعم بالطاقة'),
      ]),
    ],
  },
  {
    id: 'bad',
    en: 'Bad',
    ar: 'سيّئ',
    color: '#6f61b5',
    colorMid: '#8b7dd6',
    colorOuter: '#7a6cc2',
    tint: 'rgba(90, 76, 155, 0.18)',
    emoji: '😕',
    children: [
      n('bored', 'Bored', 'ملول', [
        n('indifferent', 'Indifferent', 'غير مبالٍ'),
        n('apathetic', 'Apathetic', 'فاتر الهمة'),
      ]),
      n('busy', 'Busy', 'مشغول', [
        n('pressured', 'Pressured', 'مضغوط'),
        n('rushed', 'Rushed', 'مستعجل'),
      ]),
      n('stressed', 'Stressed', 'متوتر', [
        n('overwhelmed_bad', 'Overwhelmed', 'مثقل'),
        n('out_of_control', 'Out of control', 'فاقد السيطرة'),
      ]),
      n('tired', 'Tired', 'متعب', [
        n('sleepy', 'Sleepy', 'نعسان'),
        n('unfocused', 'Unfocused', 'مشتت'),
      ]),
    ],
  },
  {
    id: 'fearful',
    en: 'Fearful',
    ar: 'خائف',
    color: '#E5257C',
    colorMid: '#f05fa5',
    colorOuter: '#D62E86',
    tint: 'rgba(229, 37, 124, 0.13)',
    emoji: '😨',
    children: [
      n('scared', 'Scared', 'مرعوب', [
        n('helpless', 'Helpless', 'عاجز'),
        n('frightened', 'Frightened', 'مفزوع'),
      ]),
      n('anxious', 'Anxious', 'قلق', [
        n('overwhelmed_fearful', 'Overwhelmed', 'مغمور بالقلق'),
        n('worried', 'Worried', 'منشغل البال'),
      ]),
      n('insecure', 'Insecure', 'غير آمن', [
        n('inadequate', 'Inadequate', 'غير كافٍ'),
        n('inferior_fearful', 'Inferior', 'أدنى من غيره'),
      ]),
      n('weak', 'Weak', 'ضعيف', [
        n('worthless', 'Worthless', 'عديم القيمة'),
        n('insignificant', 'Insignificant', 'غير مهم'),
      ]),
      n('rejected', 'Rejected', 'مرفوض', [
        n('excluded', 'Excluded', 'مستبعَد'),
        n('persecuted', 'Persecuted', 'مضطهَد'),
      ]),
      n('threatened', 'Threatened', 'مهدَّد', [
        n('nervous', 'Nervous', 'متوجس'),
        n('exposed', 'Exposed', 'مكشوف'),
      ]),
    ],
  },
  {
    id: 'angry',
    en: 'Angry',
    ar: 'غاضب',
    color: '#D33F49',
    colorMid: '#e0606d',
    colorOuter: '#C93848',
    tint: 'rgba(211, 63, 73, 0.13)',
    emoji: '😠',
    children: [
      n('let_down', 'Let down', 'مخذول', [
        n('betrayed', 'Betrayed', 'مخدوع'),
        n('resentful', 'Resentful', 'حاقد'),
      ]),
      n('humiliated', 'Humiliated', 'مُهان', [
        n('disrespected', 'Disrespected', 'غير محترم'),
        n('ridiculed', 'Ridiculed', 'مسخور منه'),
      ]),
      n('bitter', 'Bitter', 'ممتعض', [
        n('indignant', 'Indignant', 'ساخط'),
        n('violated', 'Violated', 'منتهَك'),
      ]),
      n('mad', 'Mad', 'محتد', [
        n('furious', 'Furious', 'هائج'),
        n('jealous', 'Jealous', 'غيور'),
      ]),
      n('aggressive', 'Aggressive', 'عدواني', [
        n('provoked', 'Provoked', 'مستفَز'),
        n('hostile', 'Hostile', 'عدائي'),
      ]),
      n('frustrated', 'Frustrated', 'محبَط', [
        n('infuriated', 'Infuriated', 'مستشيط غضباً'),
        n('annoyed', 'Annoyed', 'منزعج'),
      ]),
      n('distant', 'Distant', 'منعزل', [
        n('withdrawn', 'Withdrawn', 'منطوٍ'),
        n('numb', 'Numb', 'متخدر المشاعر'),
      ]),
      n('critical', 'Critical', 'ناقد', [
        n('skeptical', 'Skeptical', 'متشكك'),
        n('dismissive', 'Dismissive', 'مستخف'),
      ]),
    ],
  },
  {
    id: 'disgusted',
    en: 'Disgusted',
    ar: 'مشمئز',
    color: '#B06C3B',
    colorMid: '#c98a52',
    colorOuter: '#B4653A',
    tint: 'rgba(176, 108, 59, 0.15)',
    emoji: '🤢',
    children: [
      n('disapproving', 'Disapproving', 'مستنكِر', [
        n('judgmental', 'Judgmental', 'إصداري للأحكام'),
        n('embarrassed_disgusted', 'Embarrassed', 'محرَج'),
      ]),
      n('disappointed_disgusted', 'Disappointed', 'خائب الأمل', [
        n('appalled', 'Appalled', 'مروَّع'),
        n('revolted', 'Revolted', 'نافر'),
      ]),
      n('awful', 'Awful', 'شاعر بالفظاعة', [
        n('nauseated', 'Nauseated', 'شاعر بالغثيان'),
        n('detestable', 'Detestable', 'كاره لذاته'),
      ]),
      n('repelled', 'Repelled', 'منفِّر', [
        n('horrified', 'Horrified', 'مذعور'),
        n('hesitant', 'Hesitant', 'متردد'),
      ]),
    ],
  },
  {
    id: 'sad',
    en: 'Sad',
    ar: 'حزين',
    color: '#6c60ab',
    colorMid: '#9187cf',
    colorOuter: '#7d71c0',
    tint: 'rgba(93, 82, 148, 0.18)',
    emoji: '😢',
    children: [
      n('lonely', 'Lonely', 'وحيد', [
        n('isolated', 'Isolated', 'معزول'),
        n('abandoned', 'Abandoned', 'مهجور'),
      ]),
      n('vulnerable', 'Vulnerable', 'هش', [
        n('victimized', 'Victimized', 'ضحية'),
        n('fragile', 'Fragile', 'سريع التأثر'),
      ]),
      n('despair', 'Despair', 'يائس', [
        n('grief', 'Grief', 'مفجوع'),
        n('powerless', 'Powerless', 'بلا حول'),
      ]),
      n('guilty', 'Guilty', 'مذنب', [
        n('ashamed', 'Ashamed', 'خجلان'),
        n('remorseful', 'Remorseful', 'نادم'),
      ]),
      n('depressed', 'Depressed', 'مكتئب', [
        n('empty', 'Empty', 'فارغ'),
        n('inferior_sad', 'Inferior', 'شاعر بالدونية'),
      ]),
      n('hurt', 'Hurt', 'مجروح', [
        n('disappointed_sad', 'Disappointed', 'خائب الأمل'),
        n('embarrassed_sad', 'Embarrassed', 'محرَج'),
      ]),
    ],
  },
];

/** Look up a core feeling by id. */
export function getCore(coreId: string): CoreFeeling | undefined {
  return FEELINGS_WHEEL.find((c) => c.id === coreId);
}

/** Look up a secondary feeling under a core. */
export function getSecondary(coreId: string, secondaryId: string): FeelingNode | undefined {
  return getCore(coreId)?.children.find((s) => s.id === secondaryId);
}

/** Look up a tertiary feeling under a core → secondary path. */
export function getTertiary(
  coreId: string,
  secondaryId: string,
  tertiaryId: string,
): FeelingNode | undefined {
  return getSecondary(coreId, secondaryId)?.children?.find((t) => t.id === tertiaryId);
}

/** Resolve a display label for any node in the current language. */
export function label(node: FeelingNode | undefined, lang: string): string {
  if (!node) return '';
  return lang === 'ar' ? node.ar : node.en;
}
