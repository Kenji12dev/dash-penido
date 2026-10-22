/** "2d 4h", "3h 12min", "25min": duracao curta e legivel entre duas datas. */
export const duracao = (de: Date, ate: Date): string => {
  const min = Math.max(0, Math.round((ate.getTime() - de.getTime()) / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
};

/** O dia escolhido no calendario + o horario "HH:mm" do campo de hora. Sem isso
 *  `sales.date` guarda so o dia e o lembrete de call do push nao tem horario. */
export const withTime = (day: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(":").map(Number);
  const out = new Date(day);
  out.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return out;
};
