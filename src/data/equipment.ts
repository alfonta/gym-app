export interface EquipmentDef {
  id: string;
  name: string;
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'barbell', name: 'מוט אולימפי ופלטות' },
  { id: 'rack', name: 'כלוב / מתקן סקוואט' },
  { id: 'bench', name: 'ספסל ישר' },
  { id: 'adj_bench', name: 'ספסל מתכוונן (שיפוע)' },
  { id: 'dumbbells', name: 'משקולות יד' },
  { id: 'ez_bar', name: 'מוט W' },
  { id: 'cable', name: 'מכונת כבלים (פולי)' },
  { id: 'lat_pulldown', name: 'מכונת פולי עליון' },
  { id: 'cable_row', name: 'מכונת חתירה בישיבה' },
  { id: 'pullup_bar', name: 'מוט מתח' },
  { id: 'dip_bars', name: 'מקבילים' },
  { id: 'smith', name: 'מכונת סמית׳' },
  { id: 'chest_press_machine', name: 'מכונת לחיצת חזה' },
  { id: 'shoulder_press_machine', name: 'מכונת לחיצת כתפיים' },
  { id: 'pec_deck', name: 'מכונת פרפר (פק-דק)' },
  { id: 'leg_press', name: 'מכונת לחיצת רגליים' },
  { id: 'leg_ext', name: 'מכונת פשיטת ברכיים' },
  { id: 'leg_curl', name: 'מכונת כפיפת ברכיים' },
  { id: 'calf_machine', name: 'מכונת תאומים' },
];
