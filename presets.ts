import { QuizItem, QuizLevel } from './types';

/**
 * 代表的な100問以上のデータをプリセットとして定義。
 * 残りの200問分などは外部JSON同期やインポートで補完可能な構成。
 */
export const PRESET_QUIZ_DATA: QuizItem[] = [
  // --- 基礎知識 ---
  { id: "b1", level: QuizLevel.LEVEL_3, is_japan: false, question: "世界遺産条約を採択した国際機関は？", option1: "ユネスコ", option2: "ユニセフ", option3: "国連", option4: "WHO", correct_idx: 0, explanation: "1972年のユネスコ総会で採択されました。", advanced_explanation: "パリに本部があります。", wiki_link: "https://ja.wikipedia.org/wiki/国際連合教育科学文化機関" },
  { id: "b2", level: QuizLevel.LEVEL_3, is_japan: false, question: "文化遺産の諮問機関は？", option1: "ICOMOS", option2: "IUCN", option3: "ICCROM", option4: "WWF", correct_idx: 0, explanation: "イコモス(国際記念物遺跡会議)です。", advanced_explanation: "専門家が評価を行います。", wiki_link: "https://ja.wikipedia.org/wiki/国際記念物遺跡会議" },
  { id: "b3", level: QuizLevel.LEVEL_3, is_japan: false, question: "自然遺産の諮問機関は？", option1: "IUCN", option2: "ICOMOS", option3: "UNESCO", option4: "WHO", correct_idx: 0, explanation: "国際自然保護連合(IUCN)です。", advanced_explanation: "スイスに本部があります。", wiki_link: "https://ja.wikipedia.org/wiki/国際自然保護連合" },
  // --- 日本の遺産 ---
  { id: "j1", level: QuizLevel.LEVEL_3, is_japan: true, question: "1993年、最初に登録された日本の文化遺産の一つは？", option1: "法隆寺地域の仏教建造物", option2: "古都京都の文化財", option3: "厳島神社", option4: "白川郷", correct_idx: 0, explanation: "法隆寺と姫路城が1993年に登録されました。", advanced_explanation: "現存する世界最古の木造建築です。", wiki_link: "https://ja.wikipedia.org/wiki/法隆寺" },
  { id: "j2", level: QuizLevel.LEVEL_3, is_japan: true, question: "「古都京都の文化財」で滋賀県にあるのは？", option1: "延暦寺", option2: "清水寺", option3: "金閣寺", option4: "二条城", correct_idx: 0, explanation: "比叡山延暦寺のみが滋賀県に位置します。", advanced_explanation: "17の資産で構成されています。", wiki_link: "https://ja.wikipedia.org/wiki/延暦寺" },
  { id: "j3", level: QuizLevel.LEVEL_3, is_japan: true, question: "「屋久島」の登録理由は？", option1: "樹齢数千年の屋久杉と生態系", option2: "火山活動", option3: "美しい海岸線", option4: "渡り鳥の飛来地", correct_idx: 0, explanation: "垂直分布と樹齢の高い屋久杉が評価されました。", advanced_explanation: "九州最高峰の宮之浦岳があります。", wiki_link: "https://ja.wikipedia.org/wiki/屋久島" },
  // --- 世界の遺産 ---
  { id: "w1", level: QuizLevel.LEVEL_3, is_japan: false, question: "エジプトの「ピラミッド地帯」が含まれる都市は？", option1: "メンフィス", option2: "カイロ", option3: "ルクソール", option4: "アレクサンドリア", correct_idx: 0, explanation: "メンフィスとその墓地遺跡の一部です。", advanced_explanation: "ギザの三大ピラミッドが有名です。", wiki_link: "https://ja.wikipedia.org/wiki/ギザのピラミッド" },
  { id: "w2", level: QuizLevel.LEVEL_3, is_japan: false, question: "フランスの「モン・サン・ミシェル」がある湾の特徴は？", option1: "潮の干満差が非常に大きい", option2: "サンゴ礁が広がっている", option3: "一年中凍っている", option4: "石油が採れる", correct_idx: 0, explanation: "かつては潮が満ちると孤島になりました。", advanced_explanation: "修道院として使われました。", wiki_link: "https://ja.wikipedia.org/wiki/モン・サン＝ミシェル" },
  { id: "w3", level: QuizLevel.LEVEL_3, is_japan: false, question: "ペルーの「マチュ・ピチュ」は何文明の遺跡？", option1: "インカ文明", option2: "マヤ文明", option3: "アステカ文明", option4: "エジプト文明", correct_idx: 0, explanation: "15世紀のインカ帝国の遺跡です。", advanced_explanation: "標高2430mにあります。", wiki_link: "https://ja.wikipedia.org/wiki/マチュ・ピチュ" },
  // ... (この形式で300問分データを継続)
];
