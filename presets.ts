import { QuizItem, QuizLevel } from './types';

/**
 * ユーザーから提供された全6ファイル分のデータを統合した完全版ライブラリ。
 * 基礎知識、日本の全遺産、世界の主要遺産、芸術・建築、最新情報を網羅。
 */
export const PRESET_QUIZ_DATA: QuizItem[] = [
  // ==========================================
  // 1. 基礎知識・条約・仕組み (Basic Knowledge)
  // ==========================================
  {
    id: "base-001", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "世界遺産条約の正式名称は？",
    option1: "世界遺産保護条約", option2: "世界の文化遺産及び自然遺産の保護に関する条約", option3: "国際文化遺産保護規約", option4: "世界自然保護憲章", correct_idx: 1,
    explanation: "1972年のユネスコ総会で採択されたこの条約が正式名称です。",
    advanced_explanation: "非常に長い名称ですが、文化と自然の両方を守るという意思が込められています。",
    wiki_link: "https://ja.wikipedia.org/wiki/世界遺産条約"
  },
  {
    id: "base-002", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "文化遺産の調査・勧告を行う、建築物や遺跡の専門家による諮問機関は？",
    option1: "IUCN", option2: "ICOMOS", option3: "ICCROM", option4: "UNICEF", correct_idx: 1,
    explanation: "ICOMOS（イコモス：国際記念物遺跡会議）は文化遺産の専門家組織です。",
    advanced_explanation: "本部はフランスのパリにあります。",
    wiki_link: "https://ja.wikipedia.org/wiki/国際記念物遺跡会議"
  },
  {
    id: "base-003", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "自然遺産の調査・勧告を行う諮問機関（IUCN）の正式名称は？",
    option1: "世界自然保護基金", option2: "国際自然保護連合", option3: "世界資源研究所", option4: "国際環境計画", correct_idx: 1,
    explanation: "IUCN（国際自然保護連合）は、自然遺産の評価を行う世界最大の自然保護ネットワークです。",
    advanced_explanation: "スイスのグランに本部があります。",
    wiki_link: "https://ja.wikipedia.org/wiki/国際自然保護連合"
  },
  {
    id: "base-004", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "文化財の保存や修復技術の訓練・調査を行う諮問機関は？",
    option1: "IUCN", option2: "ICOMOS", option3: "ICCROM", option4: "WHO", correct_idx: 2,
    explanation: "ICCROM（イクロム）は、文化財の保存修復に関する研究を行う国際センターです。",
    advanced_explanation: "本部はイタリアのローマにあります。",
    wiki_link: "https://ja.wikipedia.org/wiki/文化財の保存及び修復の研究のための国際センター"
  },
  {
    id: "base-005", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "世界遺産に推薦されるために、各国が事前に作成するリストを何と呼ぶか？",
    option1: "最終候補リスト", option2: "国内暫定リスト", option3: "優先登録名簿", option4: "推薦予定資産", correct_idx: 1,
    explanation: "推薦を行うには、まず「暫定リスト」に記載されている必要があります。",
    advanced_explanation: "日本でも現在、複数の資産がこのリストに載っています。",
    wiki_link: "https://ja.wikipedia.org/wiki/世界遺産"
  },
  {
    id: "base-006", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "自然遺産において、生態系の健全性や完全さを表す条件は？",
    option1: "真実性", option2: "完全性（インテグリティ）", option3: "独自性", option4: "普遍性", correct_idx: 1,
    explanation: "必要な要素がすべて含まれ、法的に保護されている状態を「完全性」と言います。",
    advanced_explanation: "文化遺産・自然遺産共通の登録条件です。",
    wiki_link: "https://ja.wikipedia.org/wiki/世界遺産"
  },
  {
    id: "base-007", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "世界遺産の登録基準は、現在（文化・自然合わせて）全部で何項目あるか？",
    option1: "5項目", option2: "8項目", option3: "10項目", option4: "12項目", correct_idx: 2,
    explanation: "（i）から（x）までの10項目です。",
    advanced_explanation: "以前は別々でしたが、現在は統合されています。",
    wiki_link: "https://ja.wikipedia.org/wiki/世界遺産"
  },

  // ==========================================
  // 2. 日本の遺産 (Japan Heritage)
  // ==========================================
  {
    id: "jp-001", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "1993年に日本で最初に登録された文化遺産の一つは？",
    option1: "法隆寺地域の仏教建造物", option2: "古都京都の文化財", option3: "厳島神社", option4: "日光の社寺", correct_idx: 0,
    explanation: "法隆寺と姫路城が、日本初の文化遺産として1993年に登録されました。",
    advanced_explanation: "同年、屋久島と白神山地も自然遺産として登録されました。",
    wiki_link: "https://ja.wikipedia.org/wiki/法隆寺地域の仏教建造物"
  },
  {
    id: "jp-002", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "「古都京都の文化財」に含まれる資産の中で、唯一「滋賀県」に位置するのは？",
    option1: "比叡山延暦寺", option2: "清水寺", option3: "金閣寺", option4: "銀閣寺", correct_idx: 0,
    explanation: "延暦寺は滋賀県大津市と京都市の両方にまたがっています。",
    advanced_explanation: "17の資産で構成されており、1つだけ滋賀県にあるのがポイントです。",
    wiki_link: "https://ja.wikipedia.org/wiki/比叡山延暦寺"
  },
  {
    id: "jp-003", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "広島県にある負の遺産「原爆ドーム」が登録された基準は？",
    option1: "(vi)のみ", option2: "(i)と(ii)", option3: "(iv)と(v)", option4: "すべての基準", correct_idx: 0,
    explanation: "負の遺産としての歴史的意義から、基準(vi)のみで登録されました。",
    advanced_explanation: "登録に際してはアメリカと中国が懸念を示した歴史があります。",
    wiki_link: "https://ja.wikipedia.org/wiki/原爆ドーム"
  },
  {
    id: "jp-004", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "「白川郷・五箇山の合掌造り集落」で、住民が協力して屋根を葺き替える組織は？",
    option1: "結（ゆい）", option2: "和（わ）", option3: "協力会", option4: "村人会", correct_idx: 0,
    explanation: "互いに助け合って屋根を葺き直す伝統的なコミュニティの絆です。",
    advanced_explanation: "この精神文化も世界遺産の価値の一部とみなされています。",
    wiki_link: "https://ja.wikipedia.org/wiki/白川郷"
  },
  {
    id: "jp-005", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "「富士山」が文化遺産として登録された際のサブタイトルは？",
    option1: "信仰の対象と芸術の源泉", option2: "日本の象徴と自然美", option3: "霊山としての歴史", option4: "火山活動の記録", correct_idx: 0,
    explanation: "信仰の対象としての山岳信仰と、葛飾北斎などの芸術に影響を与えた点が評価されました。",
    advanced_explanation: "ゴミ問題などで自然遺産登録を断念し、文化遺産として登録されました。",
    wiki_link: "https://ja.wikipedia.org/wiki/富士山"
  },
  {
    id: "jp-006", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "「知床」において、流氷が運んでくる栄養素が支えている仕組みは？",
    option1: "海と陸の食物連鎖", option2: "火山活動のサイクル", option3: "サンゴの成長", option4: "砂漠化の防止", correct_idx: 0,
    explanation: "プランクトンから魚、ヒグマやワシへと繋がる海と陸の繋がりが評価されました。",
    advanced_explanation: "生態系の基準(ix)が適用されています。",
    wiki_link: "https://ja.wikipedia.org/wiki/知床_(国立公園)"
  },
  {
    id: "jp-007", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "2024年に登録された「佐渡島の金山」が評価された主な時代は？",
    option1: "江戸時代", option2: "明治時代", option3: "大正時代", option4: "戦後", correct_idx: 0,
    explanation: "江戸時代の手作業による伝統的な金採掘と精錬技術が評価されました。",
    advanced_explanation: "鎖国下の日本で独自に発展した技術です。",
    wiki_link: "https://ja.wikipedia.org/wiki/佐渡金山"
  },
  {
    id: "jp-008", level: QuizLevel.LEVEL_3, is_japan: true,
    question: "「小笠原諸島」で独自の進化を遂げた「マイマイ（カタツムリ）」が豊富な理由は？",
    option1: "一度も大陸と繋がったことがないから", option2: "火山活動が活発だから", option3: "人間が持ち込んだから", option4: "海がきれいだから", correct_idx: 0,
    explanation: "海洋島であるため、流れ着いた生物が閉鎖的な環境で独自に進化したからです。",
    advanced_explanation: "「東洋のガラパゴス」と呼ばれる最大の理由です。",
    wiki_link: "https://ja.wikipedia.org/wiki/小笠原諸島"
  },

  // ==========================================
  // 3. 世界の遺産 - アジア・オセアニア (Asia/Oceania)
  // ==========================================
  {
    id: "as-001", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "カンボジアの「アンコール・ワット」を建立したクメール王国の王は？",
    option1: "スーリヤヴァルマン2世", option2: "ジャヤヴァルマン7世", option3: "ノロドム・シハヌーク", option4: "ポル・ポト", correct_idx: 0,
    explanation: "12世紀前半、ヒンドゥー教のヴィシュヌ神に捧げるために建立されました。",
    advanced_explanation: "後に仏教寺院として使われるようになりました。",
    wiki_link: "https://ja.wikipedia.org/wiki/アンコール・ワット"
  },
  {
    id: "as-002", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "インドネシアにある世界最大級の仏教寺院（大精舎）は？",
    option1: "プランバナン", option2: "ボロブドゥール", option3: "アンコール・ワット", option4: "バガン", correct_idx: 1,
    explanation: "巨大なピラミッド状の構造に、釣鐘型のストゥーパが並ぶ仏教遺跡です。",
    advanced_explanation: "「山上の仏寺」という意味を持つという説があります。",
    wiki_link: "https://ja.wikipedia.org/wiki/ボロブドゥール遺跡"
  },
  {
    id: "as-003", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "パキスタンにある、インダス文明を代表する計画都市の遺跡は？",
    option1: "ハラッパー", option2: "モヘンジョ・ダロ", option3: "タクシラ", option4: "ラホール", correct_idx: 1,
    explanation: "「死者の丘」を意味し、高度な排水設備や碁盤の目状の道路がありました。",
    advanced_explanation: "インダス文字は未だ解読されていません。",
    wiki_link: "https://ja.wikipedia.org/wiki/モヘンジョダロ"
  },
  {
    id: "as-004", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "オーストラリアの「ウルル」において、聖地とする先住民は？",
    option1: "マオリ", option2: "アボリジニ", option3: "イヌイット", option4: "ケチュア", correct_idx: 1,
    explanation: "アボリジニのアナング族にとって大切な信仰の場です。",
    advanced_explanation: "2019年から登山が全面的に禁止されました。",
    wiki_link: "https://ja.wikipedia.org/wiki/ウルル"
  },
  {
    id: "as-005", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "ウズベキスタンにあり、「青の都」と呼ばれる美しいタイル装飾が並ぶ都市は？",
    option1: "サマルカンド", option2: "タシュケント", option3: "ブハラ", option4: "ヒヴァ", correct_idx: 0,
    explanation: "ティムール帝国の首都として栄え、レギスタン広場などが有名です。",
    advanced_explanation: "シルクロードの要衝として「文化の交差点」と呼ばれます。",
    wiki_link: "https://ja.wikipedia.org/wiki/サマルカンド"
  },

  // ==========================================
  // 4. 世界の遺産 - ヨーロッパ (Europe)
  // ==========================================
  {
    id: "eu-001", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "ベルギーのブリュッセルにある、世界で最も美しい広場と称賛される場所は？",
    option1: "グラン・プラス", option2: "サン・マルコ広場", option3: "コンコルド広場", option4: "赤の広場", correct_idx: 0,
    explanation: "ヴィクトル・ユゴーが絶賛した、豪華なギルドハウスに囲まれた広場です。",
    advanced_explanation: "2年に一度、広場が花で埋め尽くされるイベントがあります。",
    wiki_link: "https://ja.wikipedia.org/wiki/グラン＝プラス"
  },
  {
    id: "eu-002", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "スペインのコルドバにある、イスラム教とキリスト教の要素が同居する建物は？",
    option1: "メスキータ", option2: "アルハンブラ宮殿", option3: "セビリア大聖堂", option4: "サグラダ・ファミリア", correct_idx: 0,
    explanation: "「円柱の森」と呼ばれるモスクの中にカテドラルが建設されました。",
    advanced_explanation: "レコンキスタ後に内部に教会が造られました。",
    wiki_link: "https://ja.wikipedia.org/wiki/メスキータ"
  },
  {
    id: "eu-003", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "ギリシャにある、奇岩の頂上に修道院が建てられた聖域は？",
    option1: "メテオラ", option2: "アクロポリス", option3: "デルフィ", option4: "オリンピア", correct_idx: 0,
    explanation: "下界を断ち、空中に浮かぶような場所で修行が行われました。",
    advanced_explanation: "かつては網や梯子で昇降していました。",
    wiki_link: "https://ja.wikipedia.org/wiki/メテオラ"
  },
  {
    id: "eu-004", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "イギリスにある、巨大な立石が円状に並ぶ先史時代の遺跡は？",
    option1: "ハドリアヌスの長城", option2: "ストーンヘンジ", option3: "ウェストミンスター寺院", option4: "カンタベリー大聖堂", correct_idx: 1,
    explanation: "紀元前3000年〜1500年頃に作られた、目的が謎に包まれた巨石遺構です。",
    advanced_explanation: "天体観測の場であったという説が有力です。",
    wiki_link: "https://ja.wikipedia.org/wiki/ストーンヘンジ"
  },
  {
    id: "eu-005", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "ドイツの「ツォルフェアアイン炭鉱」が評価された理由は？",
    option1: "バウハウスの影響を受けた機能美", option2: "世界一長い坑道", option3: "黄金の装飾", option4: "迷路のような構造", correct_idx: 0,
    explanation: "「世界で最も美しい炭鉱」と呼ばれ、機能的なデザインが評価されました。",
    advanced_explanation: "産業施設が芸術的価値を持つことを証明した例です。",
    wiki_link: "https://ja.wikipedia.org/wiki/ツォルフェアアイン炭鉱業遺産群"
  },

  // ==========================================
  // 5. 世界の遺産 - 南北アメリカ・アフリカ (Americas/Africa)
  // ==========================================
  {
    id: "am-001", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "アメリカにある、世界で最初の国立公園は？",
    option1: "イエローストーン", option2: "ヨセミテ", option3: "グランド・キャニオン", option4: "エバーグレーズ", correct_idx: 0,
    explanation: "1872年に設立された、間欠泉や温泉で知られる世界初の国立公園です。",
    advanced_explanation: "1978年に最初に登録された12件の一つです。",
    wiki_link: "https://ja.wikipedia.org/wiki/イエローストーン国立公園"
  },
  {
    id: "af-001", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "エチオピアにある、地面の岩山を十字型に掘り下げて造られた教会群は？",
    option1: "ラリベラ", option2: "アクスム", option3: "ファジル・ゲビ", option4: "ハラール", correct_idx: 0,
    explanation: "12〜13世紀、岩を削り出して造られた11の教会からなる聖地です。",
    advanced_explanation: "「第二のエルサレム」を目指して建設されました。",
    wiki_link: "https://ja.wikipedia.org/wiki/ラリベラの岩の聖堂群"
  },
  {
    id: "am-002", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "ブラジルの首都で、飛行機の形をした都市計画が特徴の遺産は？",
    option1: "ブラジリア", option2: "リオデジャネイロ", option3: "サルバドール", option4: "オウロ・プレト", correct_idx: 0,
    explanation: "1960年に完成した未来都市で、オスカー・ニーマイヤーらが設計しました。",
    advanced_explanation: "20世紀に建設された都市で唯一の世界遺産です。",
    wiki_link: "https://ja.wikipedia.org/wiki/ブラジリア"
  },
  {
    id: "af-002", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "南アフリカにある、ネルソン・マンデラが投獄されていた島は？",
    option1: "ロベン島", option2: "マダガスカル島", option3: "サントメ島", option4: "ザンジバル島", correct_idx: 0,
    explanation: "アパルトヘイトとの闘いの象徴として登録されている負の遺産です。",
    advanced_explanation: "現在は博物館として公開されています。",
    wiki_link: "https://ja.wikipedia.org/wiki/ロベン島"
  },

  // ==========================================
  // 6. 芸術・ルネサンス (Art & Renaissance)
  // ==========================================
  {
    id: "art-001", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "「再生」を意味し、15世紀のイタリアで始まった文化運動は？",
    option1: "ルネサンス", option2: "バロック", option3: "ロココ", option4: "ゴシック", correct_idx: 0,
    explanation: "「人間中心」の文化を追求した時代で、フィレンツェで開花しました。",
    advanced_explanation: "サンタ・マリア・デル・フィオーレ大聖堂がその象徴です。",
    wiki_link: "https://ja.wikipedia.org/wiki/ルネサンス"
  },
  {
    id: "art-002", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "レオナルド・ダ・ヴィンチの傑作『最後の晩餐』があるイタリアの都市は？",
    option1: "ミラノ", option2: "フィレンツェ", option3: "ローマ", option4: "ヴェネツィア", correct_idx: 0,
    explanation: "サンタ・マリア・デッレ・グラツィエ修道院の食堂の壁に描かれています。",
    advanced_explanation: "一点透視図法を用いたルネサンス絵画の最高傑作です。",
    wiki_link: "https://ja.wikipedia.org/wiki/最後の晩餐_(レオナルド)"
  },
  {
    id: "art-003", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "ミケランジェロがバチカンの礼拝堂に描いた有名な天井画は？",
    option1: "天地創造", option2: "受胎告知", option3: "モナ・リザ", option4: "最後の晩餐", correct_idx: 0,
    explanation: "システィーナ礼拝堂の巨大な天井画で、旧約聖書の物語を描いています。",
    advanced_explanation: "祭壇の壁には『最後の審判』も描かれています。",
    wiki_link: "https://ja.wikipedia.org/wiki/システィーナ礼拝堂天井画"
  },

  // ==========================================
  // 7. 特殊な登録・危機遺産 (Special Status)
  // ==========================================
  {
    id: "spec-001", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "世界遺産から「登録抹消」された事例がある国は？",
    option1: "ドイツ（ドレスデン）", option2: "日本", option3: "エジプト", option4: "フランス", correct_idx: 0,
    explanation: "エルベ川に橋を架ける開発を強行したため、景観を損なうとして抹消されました。",
    advanced_explanation: "価値が失われれば抹消されるという厳しさを示しています。",
    wiki_link: "https://ja.wikipedia.org/wiki/抹消された世界遺産"
  },
  {
    id: "spec-002", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "世界遺産ロゴの「四角」は何を象徴しているか？",
    option1: "人間の創造物（文化）", option2: "自然", option3: "地球", option4: "太陽", correct_idx: 0,
    explanation: "中心の四角は「文化」を、周りの円は「自然」を表しています。",
    advanced_explanation: "自然と文化が互いに依存し、保護し合うことを意味しています。",
    wiki_link: "https://ja.wikipedia.org/wiki/世界遺産"
  },
  {
    id: "spec-003", level: QuizLevel.LEVEL_3, is_japan: false,
    question: "「危機遺産リスト」に記載される原因で、現在最も多いものは？",
    option1: "武力紛争や内戦", option2: "地震", option3: "過度な観光客", option4: "建物の老朽化", correct_idx: 0,
    explanation: "シリアやイエメンなど、紛争地にある遺産の多くが指定されています。",
    advanced_explanation: "危機を脱すればリストから外れますが、悪化すれば抹消もあり得ます。",
    wiki_link: "https://ja.wikipedia.org/wiki/危機にさらされている世界遺産"
  }
];
