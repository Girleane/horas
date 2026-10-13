const fields = {
  goal: document.querySelector('#dailyGoal'),
  entry: document.querySelector('#entryTime'),
  lunchStart: document.querySelector('#lunchStart'),
  lunchEnd: document.querySelector('#lunchEnd')
};
const resultTime = document.querySelector('#resultTime');
const workedSoFar = document.querySelector('#workedSoFar');
const remainingTime = document.querySelector('#remainingTime');
const resultMessage = document.querySelector('#resultMessage');
const statusPill = document.querySelector('#statusPill');

function toMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(value) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function durationLabel(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, '0')}min`;
}

function calculate() {
  const entry = toMinutes(fields.entry.value);
  const lunchStart = toMinutes(fields.lunchStart.value);
  const lunchEnd = toMinutes(fields.lunchEnd.value);
  const goal = toMinutes(fields.goal.value) || 480;
  const values = [entry, lunchStart, lunchEnd];

  localStorage.setItem('hora-certa', JSON.stringify(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]))));

  if (values.some((value) => value === null)) {
    resultTime.textContent = '--:--';
    workedSoFar.textContent = '--';
    remainingTime.textContent = '--';
    resultMessage.textContent = 'Informe as três primeiras batidas para calcular.';
    statusPill.textContent = 'Aguardando horários';
    statusPill.classList.remove('ready');
    return;
  }
  if (!(entry <= lunchStart && lunchStart <= lunchEnd)) {
    resultTime.textContent = '--:--';
    workedSoFar.textContent = '--';
    remainingTime.textContent = '--';
    resultMessage.textContent = 'Confira a ordem dos horários informados.';
    statusPill.textContent = 'Verifique as batidas';
    statusPill.classList.remove('ready');
    return;
  }

  const morning = lunchStart - entry;
  const remaining = Math.max(0, goal - morning);
  const exit = lunchEnd + remaining;
  resultTime.textContent = fromMinutes(exit);
  workedSoFar.textContent = durationLabel(morning);
  remainingTime.textContent = durationLabel(remaining);
  resultMessage.textContent = `Você completa ${durationLabel(goal)} de trabalho às ${fromMinutes(exit)}.`;
  statusPill.textContent = 'Cálculo pronto';
  statusPill.classList.add('ready');
}

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem('hora-certa') || '{}');
    Object.entries(fields).forEach(([key, field]) => { if (saved[key]) field.value = saved[key]; });
  } catch { /* Ignora dados salvos inválidos. */ }
  calculate();
}

document.querySelectorAll('input').forEach((input) => input.addEventListener('input', calculate));
document.querySelector('#clearButton').addEventListener('click', () => {
  fields.entry.value = '';
  fields.lunchStart.value = '';
  fields.lunchEnd.value = '';
  calculate();
});

function updateClock() {
  document.querySelector('#liveClock').textContent = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}
updateClock();
setInterval(updateClock, 30000);
loadSaved();
