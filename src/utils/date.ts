export function getTodayString(): string {
  const today = new Date();
  const day = today.getDate();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = monthNames[today.getMonth()];
  const year = today.getFullYear();
  return `${day} ${month} ${year}`;
}
