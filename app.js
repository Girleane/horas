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
const alarmButton = document.querySelector('#alarmButton');
const alarmStatus = document.querySelector('#alarmStatus');

let audioContext = null;
let alarmTarget = null;
let alarmTargetKey = '';
let alarmExitMinutes = null;
let alarmTimeoutId = null;
let alarmLoopTimeoutId = null;
let alarmEnabled = false;
let alarmRinging = false;
let alarmTriggeredKey = '';
const alarmSources = new Set();

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

function getTargetDate(minutes) {
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setMinutes(minutes);
  return target;
}

function setAlarmControls({ enabled = false, ringing = false, status, disabled = false } = {}) {
  alarmButton.disabled = disabled;
  alarmButton.textContent = ringing ? 'Desligar alarme' : enabled ? 'Alarme ativado' : 'Ativar alarme sonoro';
  alarmStatus.textContent = status;
}

function stopAlarmTimer() {
  if (alarmTimeoutId !== null) {
    clearTimeout(alarmTimeoutId);
    alarmTimeoutId = null;
  }
}

function stopAlarmSound() {
  alarmRinging = false;
  if (alarmLoopTimeoutId !== null) {
    clearTimeout(alarmLoopTimeoutId);
    alarmLoopTimeoutId = null;
  }
  alarmSources.forEach((source) => {
    try { source.stop(); } catch { /* O som já pode ter terminado. */ }
  });
  alarmSources.clear();
}

function playAlarm() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    alarmStatus.textContent = 'Seu navegador não oferece suporte a áudio.';
    return;
  }

  audioContext ||= new AudioContextClass();
  const start = () => {
    if (!alarmRinging) return;
    const now = audioContext.currentTime;
    const volume = 0.48;
    const toneDuration = 0.42;
    Array.from({ length: 12 }, (_, index) => index * 0.5).forEach((offset, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = index % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + toneDuration);
      oscillator.connect(gain).connect(audioContext.destination);
      alarmSources.add(oscillator);
      oscillator.addEventListener('ended', () => alarmSources.delete(oscillator), { once: true });
      oscillator.start(now + offset);
      oscillator.stop(now + offset + toneDuration + 0.02);
    });
    alarmLoopTimeoutId = window.setTimeout(() => {
      alarmLoopTimeoutId = null;
      if (alarmRinging) playAlarm();
    }, 6200);
  };

  if (audioContext.state === 'suspended') {
    audioContext.resume().then(start).catch(() => {
      alarmStatus.textContent = 'Toque em ativar novamente para liberar o som.';
    });
  } else {
    start();
  }
}

function checkAlarm() {
  if (!alarmEnabled || !alarmTarget || alarmTriggeredKey === alarmTargetKey) return;

  if (Date.now() >= alarmTarget.getTime()) {
    alarmTriggeredKey = alarmTargetKey;
    alarmEnabled = false;
    alarmRinging = true;
    stopAlarmTimer();
    playAlarm();
    setAlarmControls({ ringing: true, status: 'Hora de registrar a saída! Toque para desligar o alarme.', disabled: false });
    return;
  }

  alarmTimeoutId = window.setTimeout(checkAlarm, Math.min(alarmTarget.getTime() - Date.now(), 1000));
}

function prepareAlarm(exitMinutes) {
  const target = getTargetDate(exitMinutes);
  const targetKey = String(target.getTime());
  const changed = targetKey !== alarmTargetKey;

  stopAlarmTimer();
  alarmTarget = target;
  alarmExitMinutes = exitMinutes;
  if (changed) {
    stopAlarmSound();
    alarmTargetKey = targetKey;
    alarmTriggeredKey = '';
    alarmEnabled = false;
  }

  if (alarmRinging) {
    setAlarmControls({ ringing: true, status: 'Hora de registrar a saída! Toque para desligar o alarme.', disabled: false });
  } else if (alarmEnabled) {
    setAlarmControls({ enabled: true, status: `Alarme programado para ${fromMinutes(exitMinutes)}.`, disabled: false });
    checkAlarm();
  } else if (Date.now() >= target.getTime()) {
    setAlarmControls({ status: 'O horário calculado já passou.', disabled: true });
  } else {
    setAlarmControls({ status: 'Ative o alarme para ouvir um aviso sonoro.', disabled: false });
  }
}

function calculate() {
  const entry = toMinutes(fields.entry.value);
  const lunchStart = toMinutes(fields.lunchStart.value);
  const lunchEnd = toMinutes(fields.lunchEnd.value);
  const goal = toMinutes(fields.goal.value) || 480;
  const values = [entry, lunchStart, lunchEnd];

  localStorage.setItem('hora-certa', JSON.stringify(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]))));

  if (values.some((value) => value === null)) {
    stopAlarmTimer();
    stopAlarmSound();
    alarmTarget = null;
    alarmTargetKey = '';
    alarmExitMinutes = null;
    alarmEnabled = false;
    resultTime.textContent = '--:--';
    workedSoFar.textContent = '--';
    remainingTime.textContent = '--';
    resultMessage.textContent = 'Informe as três primeiras batidas para calcular.';
    statusPill.textContent = 'Aguardando horários';
    statusPill.classList.remove('ready');
    setAlarmControls({ status: 'Preencha os horários para ativar o alarme.', disabled: true });
    return;
  }
  if (!(entry <= lunchStart && lunchStart <= lunchEnd)) {
    stopAlarmTimer();
    stopAlarmSound();
    alarmTarget = null;
    alarmTargetKey = '';
    alarmExitMinutes = null;
    alarmEnabled = false;
    resultTime.textContent = '--:--';
    workedSoFar.textContent = '--';
    remainingTime.textContent = '--';
    resultMessage.textContent = 'Confira a ordem dos horários informados.';
    statusPill.textContent = 'Verifique as batidas';
    statusPill.classList.remove('ready');
    setAlarmControls({ status: 'Corrija os horários para ativar o alarme.', disabled: true });
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
  prepareAlarm(exit);
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

alarmButton.addEventListener('click', () => {
  if (alarmRinging) {
    stopAlarmSound();
    alarmTriggeredKey = alarmTargetKey;
    setAlarmControls({ status: 'Alarme desligado.', disabled: true });
    return;
  }
  if (!alarmTarget || alarmExitMinutes === null) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    audioContext ||= new AudioContextClass();
    audioContext.resume().catch(() => {});
  }
  alarmEnabled = true;
  alarmTriggeredKey = '';
  setAlarmControls({ enabled: true, status: `Alarme programado para ${fromMinutes(alarmExitMinutes)}.`, disabled: false });
  checkAlarm();
});

function updateClock() {
  document.querySelector('#liveClock').textContent = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}
updateClock();
setInterval(updateClock, 30000);
document.addEventListener('visibilitychange', checkAlarm);
loadSaved();
