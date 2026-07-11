const STORAGE_KEY = "work-time-records-v1";
const STANDARD_WORK_MINUTES = 8 * 60;

const form = document.querySelector("#workForm");
const dateInput = document.querySelector("#workDate");
const startInput = document.querySelector("#startTime");
const endInput = document.querySelector("#endTime");
const breakInput = document.querySelector("#breakMinutes");
const message = document.querySelector("#formMessage");
const list = document.querySelector("#recordList");
const template = document.querySelector("#recordTemplate");
const emptyState = document.querySelector("#emptyState");
const recordCount = document.querySelector("#recordCount");
const weeklyOvertime = document.querySelector("#weeklyOvertime");
const monthlyOvertime = document.querySelector("#monthlyOvertime");

let records = loadRecords();

dateInput.value = toLocalDateValue(new Date());
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  message.textContent = "";

  const breakMinutes = Number(breakInput.value);
  const elapsedMinutes = calculateElapsedMinutes(startInput.value, endInput.value);
  const workMinutes = elapsedMinutes - breakMinutes;

  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
    message.textContent = "休憩時間は0以上の整数で入力してください。";
    return;
  }
  if (workMinutes <= 0) {
    message.textContent = "休憩時間は勤務時間より短くしてください。";
    return;
  }

  records.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    date: dateInput.value,
    start: startInput.value,
    end: endInput.value,
    breakMinutes,
    workMinutes,
    overtimeMinutes: Math.max(0, workMinutes - STANDARD_WORK_MINUTES),
  });

  saveRecords();
  render();
  startInput.value = "";
  endInput.value = "";
  startInput.focus();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  records = records.filter((record) => record.id !== button.dataset.id);
  saveRecords();
  render();
});

function calculateElapsedMinutes(start, end) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

function render() {
  list.replaceChildren();
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));

  sortedRecords.forEach((record) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".record-date").textContent = formatDate(record.date);
    card.querySelector(".record-range").textContent = `${record.start}〜${record.end}`;
    card.querySelector(".record-break").textContent = `${record.breakMinutes}分`;
    card.querySelector(".record-work").textContent = formatMinutes(record.workMinutes);
    card.querySelector(".record-overtime").textContent = formatMinutes(record.overtimeMinutes);
    card.querySelector(".delete-button").dataset.id = record.id;
    list.append(card);
  });

  emptyState.hidden = records.length > 0;
  recordCount.textContent = `${records.length}件`;
  updateSummaries();
}

function updateSummaries() {
  const today = new Date();
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayFromMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - dayFromMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekly = records
    .filter((record) => {
      const date = parseLocalDate(record.date);
      return date >= weekStart && date < weekEnd;
    })
    .reduce((sum, record) => sum + record.overtimeMinutes, 0);

  const monthly = records
    .filter((record) => {
      const date = parseLocalDate(record.date);
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    })
    .reduce((sum, record) => sum + record.overtimeMinutes, 0);

  weeklyOvertime.textContent = formatMinutes(weekly);
  monthlyOvertime.textContent = formatMinutes(monthly);
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}時間${String(minutes).padStart(2, "0")}分`;
}

function formatDate(dateText) {
  const date = parseLocalDate(dateText);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}（${weekday}）`;
}

function parseLocalDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toLocalDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
