function resolveScheduleState(schedule, serverTime) {
  let activeProgram = null;
  let upcomingProgram = null;
  let lastEndedProgram = null;

  for (const program of schedule) {
    if (program.start_time <= serverTime && program.end_time > serverTime) {
      if (!activeProgram || program.start_time < activeProgram.start_time) {
        activeProgram = program;
      }
    } else if (program.start_time > serverTime) {
      if (!upcomingProgram || program.start_time < upcomingProgram.start_time) {
        upcomingProgram = program;
      }
    } else if (program.end_time <= serverTime) {
      if (!lastEndedProgram || program.end_time > lastEndedProgram.end_time) {
        lastEndedProgram = program;
      }
    }
  }

  const reason = activeProgram ? 'current' : upcomingProgram ? 'upcoming' : lastEndedProgram ? 'loop' : 'offline';
  return {
    activeProgram,
    upcomingProgram,
    lastEndedProgram,
    chosenProgram: activeProgram || (!upcomingProgram ? lastEndedProgram : null),
    reason,
    isLoop: reason === 'loop',
  };
}

module.exports = { resolveScheduleState };
