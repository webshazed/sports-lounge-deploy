const startsAt = new Date("2026-06-24T09:20:00.000Z");
try {
  const formattedDate = startsAt.toLocaleDateString(undefined, { 
    weekday: 'short', month: 'short', day: 'numeric', 
    hour: 'numeric', minute: '2-digit' 
  });
  console.log("Success:", formattedDate);
} catch (e) {
  console.log("Error:", e);
}
