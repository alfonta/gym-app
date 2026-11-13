import type { Exercise, MuscleGroup, Pattern, Tracking } from '../types';

// Images come from the public-domain free-exercise-db project
// (https://github.com/yuhonas/free-exercise-db). `media` is the folder name there.
// Hebrew names, instructions and safety tips were written for this app.

interface Def {
  id: string;
  name: string;
  mg: MuscleGroup;
  pat: Pattern;
  eq: string[];
  how: string[];
  safe: string;
  media: string;
  compound?: boolean;
  core?: boolean;
  bw?: boolean;
  track?: Tracking;
  inc?: number;
  bar?: boolean;
  rest?: number;
}

const defs: Def[] = [
  // ───────────── Chest ─────────────
  {
    id: 'bench_press', name: 'לחיצת חזה עם מוט', mg: 'chest', pat: 'h_push',
    eq: ['barbell', 'bench', 'rack'], compound: true, bar: true, inc: 2.5, rest: 150,
    media: 'Barbell_Bench_Press_-_Medium_Grip',
    how: ['שכב כשהעיניים מתחת למוט, שכמות מכווצות לאחור וכפות הרגליים נטועות ברצפה.', 'הורד את המוט בשליטה לאמצע החזה, מרפקים בזווית של כ-45 מעלות מהגוף.', 'דחוף חזרה למעלה עד יישור מלא בלי לנעול בחדות.'],
    safe: 'במשקל כבד עבוד עם בן זוג או עם מוטות ביטחון, ואל תקפיץ את המוט מהחזה.',
  },
  {
    id: 'db_bench_press', name: 'לחיצת חזה עם משקולות יד', mg: 'chest', pat: 'h_push',
    eq: ['dumbbells', 'bench'], compound: true, inc: 2, rest: 120,
    media: 'Dumbbell_Bench_Press',
    how: ['שכב על הספסל עם משקולת בכל יד בגובה החזה.', 'דחוף למעלה עד שהידיים כמעט ישרות, והורד לאט עד מתיחה נוחה בחזה.'],
    safe: 'הרם את המשקולות לעמדת הפתיחה בעזרת הברכיים ולא בכוח הכתפיים.',
  },
  {
    id: 'machine_chest_press', name: 'לחיצת חזה במכונה', mg: 'chest', pat: 'h_push',
    eq: ['chest_press_machine'], compound: true, inc: 5, rest: 120,
    media: 'Machine_Bench_Press',
    how: ['כוון את המושב כך שהידיות בגובה אמצע החזה.', 'דחוף קדימה עד יישור כמעט מלא וחזור לאט בלי שהמשקולות ייגעו.'],
    safe: 'שמור על הגב והראש צמודים למשענת לאורך כל התנועה.',
  },
  {
    id: 'smith_bench_press', name: 'לחיצת חזה בסמית׳', mg: 'chest', pat: 'h_push',
    eq: ['smith', 'bench'], compound: true, inc: 2.5, rest: 150,
    media: 'Smith_Machine_Bench_Press',
    how: ['מקם את הספסל כך שהמוט יורד לאמצע החזה.', 'שחרר את הנעילה, הורד בשליטה ודחוף חזרה למעלה.'],
    safe: 'כוון את מעצורי הביטחון מעט מתחת לגובה החזה לפני שמתחילים.',
  },
  {
    id: 'incline_db_press', name: 'לחיצת חזה בשיפוע עם משקולות', mg: 'chest', pat: 'incline_push',
    eq: ['dumbbells', 'adj_bench'], compound: true, inc: 2, rest: 120,
    media: 'Incline_Dumbbell_Press',
    how: ['כוון את הספסל לשיפוע של 30 עד 45 מעלות.', 'דחוף את המשקולות למעלה מעל החזה העליון והורד לאט לגובה הכתפיים.'],
    safe: 'אל תקשת את הגב התחתון, שמור על הישבן צמוד לספסל.',
  },
  {
    id: 'incline_bench_press', name: 'לחיצת חזה בשיפוע עם מוט', mg: 'chest', pat: 'incline_push',
    eq: ['barbell', 'adj_bench', 'rack'], compound: true, bar: true, inc: 2.5, rest: 150,
    media: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    how: ['שכב על ספסל בשיפוע של כ-30 מעלות, אחיזה מעט רחבה מהכתפיים.', 'הורד את המוט לחזה העליון ודחוף חזרה בקו ישר.'],
    safe: 'עבוד עם מוטות ביטחון או בן זוג, המוט נמצא מעל הצוואר.',
  },
  {
    id: 'cable_fly', name: 'פרפר בכבלים', mg: 'chest', pat: 'fly',
    eq: ['cable'], inc: 2.5, rest: 75,
    media: 'Cable_Crossover',
    how: ['עמוד בין שני הפולים, צעד אחד קדימה, מרפקים מעט כפופים.', 'קרב את הידיים זו לזו בקשת מול החזה וכווץ לשנייה.', 'חזור לאט עד מתיחה בחזה.'],
    safe: 'אל תיתן לידיים להימשך אחורה מעבר לקו הכתפיים.',
  },
  {
    id: 'pec_deck', name: 'פרפר במכונה', mg: 'chest', pat: 'fly',
    eq: ['pec_deck'], inc: 5, rest: 75,
    media: 'Butterfly',
    how: ['שב כשהגב צמוד למשענת והידיות בגובה החזה.', 'קרב את הידיות זו לזו, כווץ את החזה וחזור לאט.'],
    safe: 'אל תפתח את הידיים מעבר לטווח הנוח של הכתף.',
  },
  {
    id: 'db_fly', name: 'פרפר עם משקולות', mg: 'chest', pat: 'fly',
    eq: ['dumbbells', 'bench'], inc: 1, rest: 75,
    media: 'Dumbbell_Flyes',
    how: ['שכב עם משקולות מעל החזה, כפות הידיים זו מול זו ומרפקים מעט כפופים.', 'פתח את הידיים לצדדים בקשת רחבה וחזור באותו מסלול.'],
    safe: 'בחר משקל קל יחסית ואל תרד נמוך מקו הכתפיים.',
  },
  {
    id: 'pushups', name: 'שכיבות סמיכה', mg: 'chest', pat: 'h_push',
    eq: [], compound: true, bw: true, track: 'bodyweight_reps', rest: 90,
    media: 'Pushups',
    how: ['כפות ידיים מעט רחבות מהכתפיים, גוף ישר מהראש ועד העקבים.', 'רד עד שהחזה כמעט נוגע ברצפה ודחוף חזרה.'],
    safe: 'אל תיתן לאגן לצנוח, כווץ בטן וישבן.',
  },
  {
    id: 'dips', name: 'מקבילים', mg: 'chest', pat: 'h_push',
    eq: ['dip_bars'], compound: true, bw: true, track: 'bodyweight_reps', rest: 120,
    media: 'Dips_-_Chest_Version',
    how: ['עלה על המקבילים בידיים ישרות והטה מעט את הגוף קדימה.', 'רד עד שהזרוע מקבילה לרצפה ודחוף חזרה למעלה.'],
    safe: 'אל תרד עמוק מדי אם אתה מרגיש לחץ בקדמת הכתף.',
  },

  // ───────────── Shoulders ─────────────
  {
    id: 'ohp', name: 'לחיצת כתפיים בעמידה עם מוט', mg: 'shoulders', pat: 'v_push',
    eq: ['barbell', 'rack'], compound: true, bar: true, inc: 2.5, rest: 150,
    media: 'Standing_Military_Press',
    how: ['אחוז במוט ברוחב הכתפיים, המוט נח על החזה העליון.', 'דחוף ישר למעלה והעבר את הראש קדימה כשהמוט חולף על פניו.', 'הורד בשליטה חזרה לחזה העליון.'],
    safe: 'כווץ בטן וישבן כדי לא לקשת את הגב התחתון.',
  },
  {
    id: 'db_shoulder_press', name: 'לחיצת כתפיים עם משקולות', mg: 'shoulders', pat: 'v_push',
    eq: ['dumbbells', 'adj_bench'], compound: true, inc: 2, rest: 120,
    media: 'Dumbbell_Shoulder_Press',
    how: ['שב על ספסל זקוף, משקולות בגובה האוזניים.', 'דחוף למעלה עד יישור כמעט מלא והורד לאט.'],
    safe: 'שמור על הגב צמוד למשענת ואל תנעל מרפקים בחדות.',
  },
  {
    id: 'machine_shoulder_press', name: 'לחיצת כתפיים במכונה', mg: 'shoulders', pat: 'v_push',
    eq: ['shoulder_press_machine'], compound: true, inc: 5, rest: 120,
    media: 'Machine_Shoulder_Military_Press',
    how: ['כוון את המושב כך שהידיות בגובה הכתפיים.', 'דחוף למעלה וחזור לאט בלי להניח את המשקולות.'],
    safe: 'אל תנתק את הגב מהמשענת.',
  },
  {
    id: 'lateral_raise', name: 'הרחקות לצדדים עם משקולות', mg: 'shoulders', pat: 'lateral_raise',
    eq: ['dumbbells'], inc: 1, rest: 60,
    media: 'Side_Lateral_Raise',
    how: ['עמוד עם משקולות בצידי הגוף ומרפקים מעט כפופים.', 'הרם לצדדים עד גובה הכתפיים והורד לאט.'],
    safe: 'בלי תנופה מהגוף. אם צריך להתנדנד, המשקל כבד מדי.',
  },
  {
    id: 'cable_lateral_raise', name: 'הרחקה לצד בכבל', mg: 'shoulders', pat: 'lateral_raise',
    eq: ['cable'], inc: 2.5, rest: 60,
    media: 'Cable_Seated_Lateral_Raise',
    how: ['עמוד בצד הפולי התחתון ואחוז בידית ביד הרחוקה.', 'הרם את היד לצד עד גובה הכתף וחזור בשליטה.'],
    safe: 'שמור על כתף רחוקה מהאוזן, בלי למשוך עם הטרפז.',
  },

  // ───────────── Triceps ─────────────
  {
    id: 'triceps_pushdown', name: 'פשיטת מרפקים בפולי עליון', mg: 'triceps', pat: 'elbow_ext',
    eq: ['cable'], inc: 2.5, rest: 60,
    media: 'Triceps_Pushdown',
    how: ['עמוד מול הפולי העליון, מרפקים צמודים לצידי הגוף.', 'דחוף את הידית למטה עד יישור מלא וחזור לאט עד 90 מעלות.'],
    safe: 'המרפקים נשארים במקום, רק האמות זזות.',
  },
  {
    id: 'overhead_triceps_ext', name: 'פשיטת מרפקים מעל הראש בכבל', mg: 'triceps', pat: 'elbow_ext',
    eq: ['cable'], inc: 2.5, rest: 60,
    media: 'Cable_Rope_Overhead_Triceps_Extension',
    how: ['עמוד עם הגב לפולי, החבל מאחורי הראש ומרפקים פונים קדימה.', 'יישר את הידיים קדימה ולמעלה וחזור לאט למתיחה.'],
    safe: 'שמור על בטן מכווצת כדי לא לקשת את הגב.',
  },
  {
    id: 'skullcrusher', name: 'פשיטת מרפקים בשכיבה עם מוט W', mg: 'triceps', pat: 'elbow_ext',
    eq: ['ez_bar', 'bench'], inc: 2.5, rest: 75,
    media: 'EZ-Bar_Skullcrusher',
    how: ['שכב עם המוט מעל החזה בידיים ישרות.', 'כופף רק את המרפקים והורד את המוט לכיוון המצח.', 'יישר חזרה למעלה.'],
    safe: 'הורד לאט ובשליטה מלאה, המוט נמצא מעל הפנים.',
  },
  {
    id: 'db_overhead_ext', name: 'פשיטת מרפקים מעל הראש עם משקולת', mg: 'triceps', pat: 'elbow_ext',
    eq: ['dumbbells'], inc: 2, rest: 60,
    media: 'Standing_Dumbbell_Triceps_Extension',
    how: ['אחוז משקולת אחת בשתי ידיים מעל הראש.', 'הורד אותה מאחורי הראש בכיפוף מרפקים ויישר חזרה.'],
    safe: 'שמור על המרפקים קרובים לראש ואל תקשת את הגב.',
  },

  // ───────────── Back ─────────────
  {
    id: 'barbell_row', name: 'חתירה בהטיה עם מוט', mg: 'back', pat: 'h_pull',
    eq: ['barbell'], compound: true, bar: true, inc: 2.5, rest: 150,
    media: 'Bent_Over_Barbell_Row',
    how: ['כופף ברכיים קלות והטה את הגו קדימה כשהגב ישר.', 'משוך את המוט לכיוון הבטן התחתונה וכווץ את השכמות.', 'הורד בשליטה עד יישור הידיים.'],
    safe: 'גב ישר לכל אורך התנועה. אם הגב מתעגל, הורד משקל.',
  },
  {
    id: 'lat_pulldown', name: 'משיכת פולי עליון', mg: 'back', pat: 'v_pull',
    eq: ['lat_pulldown'], compound: true, inc: 5, rest: 120,
    media: 'Wide-Grip_Lat_Pulldown',
    how: ['שב עם הירכיים נעולות מתחת לכריות ואחוז במוט באחיזה רחבה.', 'משוך את המוט לחזה העליון תוך הורדת המרפקים למטה ואחורה.', 'חזור לאט עד יישור מלא.'],
    safe: 'משוך תמיד לפני הראש ולא מאחורי העורף.',
  },
  {
    id: 'pullups', name: 'עליות מתח', mg: 'back', pat: 'v_pull',
    eq: ['pullup_bar'], compound: true, bw: true, track: 'bodyweight_reps', rest: 150,
    media: 'Pullups',
    how: ['היתלה על המוט באחיזה מעט רחבה מהכתפיים.', 'משוך את עצמך למעלה עד שהסנטר מעל המוט ורד בשליטה.'],
    safe: 'רד לאט, בלי ליפול לתלייה על הכתפיים.',
  },
  {
    id: 'seated_cable_row', name: 'חתירה בישיבה בכבל', mg: 'back', pat: 'h_pull',
    eq: ['cable_row'], compound: true, inc: 5, rest: 120,
    media: 'Seated_Cable_Rows',
    how: ['שב זקוף עם ברכיים מעט כפופות ואחוז בידית.', 'משוך לכיוון הבטן וכווץ את השכמות זו לזו.', 'חזור לאט עד מתיחה מלאה בגב.'],
    safe: 'אל תתנדנד עם הגו, הגב נשאר זקוף.',
  },
  {
    id: 'one_arm_db_row', name: 'חתירה ביד אחת עם משקולת', mg: 'back', pat: 'h_pull',
    eq: ['dumbbells', 'bench'], compound: true, inc: 2, rest: 90,
    media: 'One-Arm_Dumbbell_Row',
    how: ['הנח ברך ויד על הספסל, גב ישר ומקביל לרצפה.', 'משוך את המשקולת לכיוון המותן והורד לאט.'],
    safe: 'אל תסובב את הגו כדי להרים, הכתפיים נשארות מקבילות לרצפה.',
  },
  {
    id: 'straight_arm_pulldown', name: 'משיכה בידיים ישרות בכבל', mg: 'back', pat: 'v_pull',
    eq: ['cable'], inc: 2.5, rest: 75,
    media: 'Straight-Arm_Pulldown',
    how: ['עמוד מול הפולי העליון, ידיים ישרות ומעט קדימה.', 'משוך את המוט בקשת עד הירכיים וחזור לאט.'],
    safe: 'שמור על גב ישר ואל תכופף מרפקים.',
  },

  // ───────────── Rear delts ─────────────
  {
    id: 'face_pull', name: 'פייס פול בכבל', mg: 'rear_delts', pat: 'rear_fly',
    eq: ['cable'], inc: 2.5, rest: 60,
    media: 'Face_Pull',
    how: ['כוון את הפולי לגובה הפנים ואחוז בחבל.', 'משוך לכיוון הפנים כשהמרפקים גבוהים ונפתחים לצדדים.', 'חזור לאט.'],
    safe: 'עבוד במשקל קל ובתנועה נקייה, בלי הטיה אחורה.',
  },
  {
    id: 'reverse_pec_deck', name: 'פרפר הפוך במכונה', mg: 'rear_delts', pat: 'rear_fly',
    eq: ['pec_deck'], inc: 5, rest: 60,
    media: 'Reverse_Machine_Flyes',
    how: ['שב עם הפנים למשענת ואחוז בידיות לפניך.', 'פתח את הידיים לצדדים ואחורה וחזור לאט.'],
    safe: 'אל תרים את הכתפיים לכיוון האוזניים.',
  },
  {
    id: 'reverse_db_fly', name: 'פרפר הפוך עם משקולות', mg: 'rear_delts', pat: 'rear_fly',
    eq: ['dumbbells'], inc: 1, rest: 60,
    media: 'Reverse_Flyes',
    how: ['הטה את הגו קדימה עם גב ישר, משקולות תלויות למטה.', 'הרם לצדדים עד גובה הכתפיים והורד לאט.'],
    safe: 'בחר משקל קל, בלי תנופה מהגב.',
  },

  // ───────────── Biceps ─────────────
  {
    id: 'barbell_curl', name: 'כפיפת מרפקים עם מוט', mg: 'biceps', pat: 'elbow_flex',
    eq: ['barbell'], bar: false, inc: 2.5, rest: 75,
    media: 'Barbell_Curl',
    how: ['עמוד זקוף, אחיזה ברוחב הכתפיים ומרפקים צמודים לגוף.', 'כופף את המרפקים והרם את המוט לגובה הכתפיים.', 'הורד לאט עד יישור מלא.'],
    safe: 'בלי להתנדנד אחורה. הגב נשאר זקוף.',
  },
  {
    id: 'ez_curl', name: 'כפיפת מרפקים עם מוט W', mg: 'biceps', pat: 'elbow_flex',
    eq: ['ez_bar'], inc: 2.5, rest: 75,
    media: 'EZ-Bar_Curl',
    how: ['אחוז במוט בחלק המשופע, מרפקים צמודים לגוף.', 'הרם לגובה הכתפיים והורד לאט.'],
    safe: 'אל תזיז את המרפקים קדימה בזמן ההרמה.',
  },
  {
    id: 'db_curl', name: 'כפיפת מרפקים עם משקולות', mg: 'biceps', pat: 'elbow_flex',
    eq: ['dumbbells'], inc: 1, rest: 60,
    media: 'Dumbbell_Bicep_Curl',
    how: ['עמוד עם משקולת בכל יד, כפות ידיים פונות קדימה.', 'כופף את המרפקים עד למעלה והורד בשליטה.'],
    safe: 'שמור על שורש כף היד ישר.',
  },
  {
    id: 'hammer_curl', name: 'כפיפת פטישים', mg: 'biceps', pat: 'elbow_flex',
    eq: ['dumbbells'], inc: 1, rest: 60,
    media: 'Hammer_Curls',
    how: ['אחוז במשקולות כשכפות הידיים פונות זו לזו.', 'הרם לכיוון הכתפיים בלי לסובב את היד והורד לאט.'],
    safe: 'מרפקים צמודים לגוף, בלי תנופה.',
  },
  {
    id: 'cable_curl', name: 'כפיפת מרפקים בכבל', mg: 'biceps', pat: 'elbow_flex',
    eq: ['cable'], inc: 2.5, rest: 60,
    media: 'Standing_Biceps_Cable_Curl',
    how: ['עמוד מול הפולי התחתון ואחוז במוט באחיזה תחתית.', 'כופף מרפקים עד למעלה וחזור לאט.'],
    safe: 'אל תישען אחורה כדי לעזור להרמה.',
  },

  // ───────────── Quads ─────────────
  {
    id: 'squat', name: 'סקוואט עם מוט', mg: 'quads', pat: 'squat',
    eq: ['barbell', 'rack'], compound: true, bar: true, inc: 5, rest: 180,
    media: 'Barbell_Squat',
    how: ['הנח את המוט על הטרפז העליון, רגליים ברוחב הכתפיים.', 'שלח את האגן אחורה ורד עד שהירכיים לפחות מקבילות לרצפה.', 'דחוף דרך כל כף הרגל חזרה לעמידה.'],
    safe: 'הברכיים נעות בכיוון האצבעות ולא קורסות פנימה. עבוד עם מוטות ביטחון.',
  },
  {
    id: 'smith_squat', name: 'סקוואט בסמית׳', mg: 'quads', pat: 'squat',
    eq: ['smith'], compound: true, inc: 5, rest: 150,
    media: 'Smith_Machine_Squat',
    how: ['עמוד מתחת למוט כשהרגליים מעט קדימה.', 'רד עד שהירכיים מקבילות לרצפה ודחוף חזרה.'],
    safe: 'כוון מעצורי ביטחון ואל תנעל ברכיים בחדות.',
  },
  {
    id: 'goblet_squat', name: 'סקוואט גביע', mg: 'quads', pat: 'squat',
    eq: ['dumbbells'], compound: true, inc: 2, rest: 120,
    media: 'Goblet_Squat',
    how: ['אחוז משקולת אחת צמוד לחזה בשתי ידיים.', 'רד לסקוואט עמוק כשהחזה זקוף ועלה חזרה.'],
    safe: 'שמור על העקבים על הרצפה.',
  },
  {
    id: 'leg_press', name: 'לחיצת רגליים', mg: 'quads', pat: 'squat',
    eq: ['leg_press'], compound: true, inc: 10, rest: 150,
    media: 'Leg_Press',
    how: ['מקם כפות רגליים ברוחב הכתפיים באמצע המשטח.', 'הורד את המשטח עד זווית של כ-90 מעלות בברך.', 'דחוף חזרה בלי לנעול ברכיים.'],
    safe: 'אל תיתן לגב התחתון להתנתק מהמושב בתחתית התנועה.',
  },
  {
    id: 'leg_extension', name: 'פשיטת ברכיים במכונה', mg: 'quads', pat: 'knee_ext',
    eq: ['leg_ext'], inc: 5, rest: 75,
    media: 'Leg_Extensions',
    how: ['כוון את הכרית מעל הקרסול ואת ציר המכונה מול הברך.', 'יישר את הרגליים, כווץ לשנייה והורד לאט.'],
    safe: 'בלי בעיטה ותנופה, תנועה איטית ומבוקרת.',
  },
  {
    id: 'db_lunges', name: 'מכרעים עם משקולות', mg: 'quads', pat: 'lunge',
    eq: ['dumbbells'], compound: true, inc: 2, rest: 120,
    media: 'Dumbbell_Lunges',
    how: ['עמוד עם משקולת בכל יד וצעד צעד גדול קדימה.', 'רד עד שהברך האחורית כמעט נוגעת ברצפה.', 'דחוף חזרה והחלף רגל.'],
    safe: 'שמור על גו זקוף ועל הברך הקדמית מעל כף הרגל.',
  },
  {
    id: 'split_squat', name: 'ספליט סקוואט עם משקולות', mg: 'quads', pat: 'lunge',
    eq: ['dumbbells'], compound: true, inc: 2, rest: 120,
    media: 'Split_Squat_with_Dumbbells',
    how: ['עמוד בפיסוק קדימה-אחורה, משקולת בכל יד.', 'רד ישר למטה עד שהברך האחורית קרובה לרצפה ועלה.'],
    safe: 'רוב המשקל על הרגל הקדמית, בלי לקפוץ בתחתית.',
  },

  // ───────────── Hamstrings / Glutes ─────────────
  {
    id: 'rdl', name: 'דדליפט רומני', mg: 'hamstrings', pat: 'hinge',
    eq: ['barbell'], compound: true, bar: true, inc: 5, rest: 150,
    media: 'Romanian_Deadlift',
    how: ['עמוד עם המוט צמוד לירכיים וברכיים מעט כפופות.', 'שלח את האגן אחורה והורד את המוט לאורך הרגליים עד מתיחה בירך האחורית.', 'חזור לעמידה בדחיפת האגן קדימה.'],
    safe: 'גב ישר כל הזמן. עצור כשהגב מתחיל להתעגל.',
  },
  {
    id: 'db_rdl', name: 'דדליפט רומני עם משקולות', mg: 'hamstrings', pat: 'hinge',
    eq: ['dumbbells'], compound: true, inc: 2, rest: 120,
    media: 'Stiff-Legged_Dumbbell_Deadlift',
    how: ['אחוז משקולות לפני הירכיים, ברכיים מעט כפופות.', 'הורד אותן לאורך הרגליים בשליחת האגן אחורה וחזור לעמידה.'],
    safe: 'המשקולות נשארות קרובות לגוף והגב ישר.',
  },
  {
    id: 'deadlift', name: 'דדליפט', mg: 'hamstrings', pat: 'hinge',
    eq: ['barbell'], compound: true, bar: true, inc: 5, rest: 180,
    media: 'Barbell_Deadlift',
    how: ['עמוד כשהמוט מעל אמצע כף הרגל ואחוז בו מחוץ לברכיים.', 'חזה למעלה, גב ישר, ודחוף את הרצפה עד עמידה זקופה.', 'הורד בשליטה באותו מסלול.'],
    safe: 'לעולם לא להרים בגב מעוגל. התחל במשקל שמאפשר טכניקה מושלמת.',
  },
  {
    id: 'lying_leg_curl', name: 'כפיפת ברכיים בשכיבה', mg: 'hamstrings', pat: 'knee_flex',
    eq: ['leg_curl'], inc: 5, rest: 75,
    media: 'Lying_Leg_Curls',
    how: ['שכב על הבטן כשהכרית מעל העקבים.', 'כופף ברכיים עד כמה שאפשר והורד לאט.'],
    safe: 'אל תרים את האגן מהמשטח כדי לעזור לתנועה.',
  },
  {
    id: 'hip_thrust', name: 'היפ תראסט עם מוט', mg: 'glutes', pat: 'hinge',
    eq: ['barbell', 'bench'], compound: true, bar: true, inc: 5, rest: 120,
    media: 'Barbell_Hip_Thrust',
    how: ['השען שכמות על ספסל כשהמוט מונח על קפל הירך.', 'דחוף את האגן למעלה עד קו ישר מהכתפיים לברכיים וכווץ ישבן.', 'הורד לאט.'],
    safe: 'סנטר לחזה ובלי להקשית את הגב התחתון בחלק העליון.',
  },

  // ───────────── Calves ─────────────
  {
    id: 'standing_calf_raise', name: 'הרמות עקבים בעמידה', mg: 'calves', pat: 'calf',
    eq: ['calf_machine'], inc: 5, rest: 60,
    media: 'Standing_Calf_Raises',
    how: ['עמוד עם כריות הרגליים על קצה המדרגה.', 'עלה גבוה על קצות האצבעות, עצור שנייה ורד למתיחה מלאה.'],
    safe: 'תנועה איטית, בלי לקפוץ בתחתית.',
  },
  {
    id: 'leg_press_calf', name: 'תאומים במכונת לחיצת רגליים', mg: 'calves', pat: 'calf',
    eq: ['leg_press'], inc: 10, rest: 60,
    media: 'Calf_Press_On_The_Leg_Press_Machine',
    how: ['הנח רק את כריות הרגליים על תחתית המשטח, רגליים כמעט ישרות.', 'דחוף עם קצות האצבעות וחזור למתיחה.'],
    safe: 'אל תשחרר את נעילת הביטחון של המכונה בתרגיל הזה.',
  },
  {
    id: 'db_calf_raise', name: 'הרמות עקבים עם משקולות', mg: 'calves', pat: 'calf',
    eq: ['dumbbells'], inc: 2, rest: 60,
    media: 'Standing_Dumbbell_Calf_Raise',
    how: ['עמוד עם משקולת בכל יד, רצוי על מדרגה.', 'עלה גבוה על קצות האצבעות ורד לאט.'],
    safe: 'שמור על שיווי משקל, אפשר להיעזר בקיר.',
  },

  // ───────────── Core ─────────────
  {
    id: 'plank', name: 'פלאנק', mg: 'core', pat: 'core_static',
    eq: [], core: true, bw: true, track: 'time', rest: 30,
    media: 'Plank',
    how: ['הישען על האמות וקצות האצבעות, מרפקים מתחת לכתפיים.', 'שמור על קו ישר מהראש לעקבים וכווץ בטן וישבן.'],
    safe: 'עצור כשהאגן מתחיל לצנוח.',
  },
  {
    id: 'crunches', name: 'כפיפות בטן', mg: 'core', pat: 'core_flex',
    eq: [], core: true, bw: true, track: 'bodyweight_reps', rest: 30,
    media: 'Crunches',
    how: ['שכב על הגב עם ברכיים כפופות וידיים לצידי הראש.', 'הרם את השכמות מהרצפה בכיווץ הבטן ורד לאט.'],
    safe: 'אל תמשוך את הצוואר עם הידיים.',
  },
  {
    id: 'lying_leg_raise', name: 'הרמות רגליים בשכיבה', mg: 'core', pat: 'core_legs',
    eq: [], core: true, bw: true, track: 'bodyweight_reps', rest: 30,
    media: 'Flat_Bench_Lying_Leg_Raise',
    how: ['שכב על הגב עם ידיים לצידי הגוף.', 'הרם רגליים ישרות עד 90 מעלות והורד לאט בלי לגעת ברצפה.'],
    safe: 'שמור על הגב התחתון צמוד למשטח.',
  },
  {
    id: 'hanging_leg_raise', name: 'הרמות רגליים בתלייה', mg: 'core', pat: 'core_legs',
    eq: ['pullup_bar'], core: true, bw: true, track: 'bodyweight_reps', rest: 30,
    media: 'Hanging_Leg_Raise',
    how: ['היתלה על מוט המתח בידיים ישרות.', 'הרם את הרגליים קדימה עד גובה האגן ורד בשליטה.'],
    safe: 'בלי להתנדנד. אם קשה, כופף ברכיים.',
  },
  {
    id: 'cable_crunch', name: 'כפיפות בטן בכבל', mg: 'core', pat: 'core_flex',
    eq: ['cable'], core: true, inc: 2.5, rest: 30,
    media: 'Cable_Crunch',
    how: ['כרע מול הפולי העליון עם החבל לצידי הראש.', 'כופף את הגו למטה בכיווץ הבטן וחזור לאט.'],
    safe: 'התנועה מהבטן ולא מהירכיים. האגן נשאר במקום.',
  },
  {
    id: 'russian_twist', name: 'סיבובי גו רוסיים', mg: 'core', pat: 'core_rot',
    eq: [], core: true, bw: true, track: 'bodyweight_reps', rest: 30,
    media: 'Russian_Twist',
    how: ['שב עם ברכיים כפופות והטה את הגו מעט אחורה.', 'סובב את הגו מצד לצד בתנועה מבוקרת.'],
    safe: 'שמור על גב ישר ולא מעוגל.',
  },
  {
    id: 'air_bike', name: 'בטן אופניים', mg: 'core', pat: 'core_rot',
    eq: [], core: true, bw: true, track: 'bodyweight_reps', rest: 30,
    media: 'Air_Bike',
    how: ['שכב על הגב, ידיים לצידי הראש ורגליים באוויר.', 'קרב מרפק לברך הנגדית לסירוגין בתנועת דיווש.'],
    safe: 'אל תמשוך את הצוואר, המבט לתקרה.',
  },
  {
    id: 'dead_bug', name: 'דד באג', mg: 'core', pat: 'core_static',
    eq: [], core: true, bw: true, track: 'bodyweight_reps', rest: 30,
    media: 'Dead_Bug',
    how: ['שכב על הגב, ידיים למעלה וברכיים ב-90 מעלות.', 'הורד יד ורגל נגדיות לכיוון הרצפה וחזור. החלף צד.'],
    safe: 'הגב התחתון נשאר צמוד לרצפה כל הזמן.',
  },
  {
    id: 'mountain_climbers', name: 'מטפסי הרים', mg: 'core', pat: 'core_legs',
    eq: [], core: true, bw: true, track: 'time', rest: 30,
    media: 'Mountain_Climbers',
    how: ['היכנס למצב שכיבת סמיכה בידיים ישרות.', 'משוך ברך לחזה לסירוגין בקצב מהיר.'],
    safe: 'שמור על האגן נמוך ועל הכתפיים מעל הידיים.',
  },
];

function defaultRest(d: Def): number {
  if (d.core) return 30;
  return d.compound ? 150 : 75;
}

export const EXERCISES: Exercise[] = defs.map((d) => ({
  id: d.id,
  name: d.name,
  muscle_group: d.mg,
  pattern: d.pat,
  equipment_ids: d.eq,
  instructions_tips: d.how,
  safety_tip: d.safe,
  media_urls: [`media/${d.media}/0.jpg`, `media/${d.media}/1.jpg`],
  rest_time_seconds: d.rest ?? defaultRest(d),
  is_core: !!d.core,
  is_compound: !!d.compound,
  is_bodyweight: !!d.bw,
  tracking: d.track ?? 'weight_reps',
  increment_kg: d.inc ?? 2.5,
  uses_barbell: !!d.bar,
}));

export const EXERCISE_MAP: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
);

/** Folder names in free-exercise-db, used by scripts/fetch-media.mjs. */
export const MEDIA_FOLDERS: string[] = defs.map((d) => d.media);

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'חזה', shoulders: 'כתפיים', triceps: 'יד אחורית',
  back: 'גב', biceps: 'יד קדמית', rear_delts: 'כתף אחורית',
  quads: 'ירך קדמית', hamstrings: 'ירך אחורית', glutes: 'ישבן', calves: 'תאומים',
  core: 'בטן',
};
