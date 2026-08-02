const STORAGE_KEY = "work-time-records-v1";
const ACTIVE_WORK_KEY = "work-time-active-v1";
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
const startWorkButton = document.querySelector("#startWorkButton");
const endWorkButton = document.querySelector("#endWorkButton");
const cancelWorkButton = document.querySelector("#cancelWorkButton");
const activeWorkStatus = document.querySelector("#activeWorkStatus");
const activeWorkTitle = document.querySelector("#activeWorkTitle");
const activeWorkDetail = document.querySelector("#activeWorkDetail");
const workStatusLabel = document.querySelector("#workStatusLabel");

let records = loadRecords();
let activeWork = loadActiveWork();

dateInput.value = toLocalDateValue(new Date());
restoreActiveWork();
render();

form.addEventListener("submit", (event) => event.preventDefault());

startWorkButton.addEventListener("click", () => {
  message.textContent = "";

  if (activeWork) return;

  const now = new Date();
  activeWork = {
    date: dateInput.value,
    start: startInput.value || toLocalTimeValue(now),
  };

  localStorage.setItem(ACTIVE_WORK_KEY, JSON.stringify(activeWork));
  restoreActiveWork();
  message.classList.add("success");
  message.textContent = "勤務開始を保存しました。退勤時にもう一度このページを開いてください。";
});

endWorkButton.addEventListener("click", () => {
  message.classList.remove("success");
  message.textContent = "";

  if (!activeWork) {
    message.textContent = "先に勤務開始を保存してください。";
    return;
  }

  const breakMinutes = Number(breakInput.value);
  const endTime = endInput.value || toLocalTimeValue(new Date());
  const elapsedMinutes = calculateElapsedMinutes(activeWork.start, endTime);
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
    date: activeWork.date,
    start: activeWork.start,
    end: endTime,
    breakMinutes,
    workMinutes,
    overtimeMinutes: Math.max(0, workMinutes - STANDARD_WORK_MINUTES),
  });

  saveRecords();
  activeWork = null;
  localStorage.removeItem(ACTIVE_WORK_KEY);
  render();
  dateInput.value = toLocalDateValue(new Date());
  startInput.value = "";
  endInput.value = "";
  restoreActiveWork();
  message.classList.add("success");
  message.textContent = "勤務終了を保存し、実働時間と残業時間を計算しました。";
});

cancelWorkButton.addEventListener("click", () => {
  if (!activeWork || !confirm("保存した勤務開始を取り消しますか？")) return;
  activeWork = null;
  localStorage.removeItem(ACTIVE_WORK_KEY);
  dateInput.value = toLocalDateValue(new Date());
  startInput.value = "";
  endInput.value = "";
  restoreActiveWork();
  message.classList.remove("success");
  message.textContent = "勤務開始を取り消しました。";
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

function loadActiveWork() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_WORK_KEY));
    return saved && saved.date && saved.start ? saved : null;
  } catch {
    return null;
  }
}

function restoreActiveWork() {
  const isWorking = Boolean(activeWork);
  startWorkButton.disabled = isWorking;
  endWorkButton.disabled = !isWorking;
  cancelWorkButton.hidden = !isWorking;
  dateInput.disabled = isWorking;
  startInput.disabled = isWorking;
  endInput.disabled = !isWorking;
  breakInput.disabled = !isWorking;
  activeWorkStatus.classList.toggle("working", isWorking);
  workStatusLabel.classList.toggle("working", isWorking);

  if (isWorking) {
    dateInput.value = activeWork.date;
    startInput.value = activeWork.start;
    workStatusLabel.textContent = "勤務中";
    activeWorkTitle.textContent = `${activeWork.start}から勤務中です`;
    activeWorkDetail.textContent = "開始時刻は保存済みです。退勤時に勤務終了を保存してください。";
  } else {
    workStatusLabel.textContent = "開始前";
    activeWorkTitle.textContent = "勤務開始前です";
    activeWorkDetail.textContent = "開始時刻を入力するか、空欄のまま開始ボタンを押してください。";
  }
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

function toLocalTimeValue(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
