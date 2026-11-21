// The story: Dara, a getaway driver, owes the harbor boss eight jobs.
// Every job is pickup, timed drive, drop-off, and every job has its own
// twist — a steal, a three-stop run, a race, a getaway under full heat.
// Finish all eight and the $6,400 debt is gone.
//
// The jobs live in one compact table — id, title, pay, clock, pickup,
// drop, options, briefing — and a builder turns each row into the job
// object missions.js drives. A job's options can carry:
//   steal — the pickup is a marked car; getting in it starts the escape
//   heat — wanted stars added the moment the cargo is picked up
//   drops — drop-offs in order; the clock applies to each leg
//   race — Viko the rival drives the route too; beat him to the finish
//   stealColor — the marked car's paint
// Police-radio chatter for the dispatch panel, one line per wanted level.
// The HUD cycles them so the panel reads as a live radio, not a label.
export const DISPATCH_LINES = [
  [], // 0 stars — the panel stays hidden
  ['"Unit 12, a 10-50 at the market — eyes on the sedan, do not engage."'],
  ['"All units, suspect is mobile — eastbound along the bay road."'],
  ['"Roadblock at the north gate — cars across the road, spike strips ready."'],
  ['"Air One is up — spotlight on the suspect, hold visual."'],
  ['"Five stars — every unit in the bay converges on the harbor now."'],
];

// One job, one object: id, title, pay, clock, pickup, drop, options, briefing.
// A job's options can carry:
//   steal — the pickup is a marked car; getting in it starts the escape
//   heat — wanted stars added the moment the cargo is picked up
//   drops — drop-offs in order; the clock applies to each leg
//   race — Viko the rival drives the route too; beat him to the finish
//   stealColor — the marked car's paint
const JOB_TABLE = [
  {
    id: 1, title: 'First Fare', pay: 400, time: 100,
    pickup: { label: 'Night Market', x: -80, z: -8 },
    drop: { label: 'Harbor Dock 2', x: -60, z: 106 },
    briefing: 'Madame Sari: "A package waits at the night market. Carry it to the harbor. No questions, no stops."',
  },
  {
    id: 2, title: 'The Courier', pay: 600, time: 85,
    pickup: { label: 'Downtown Plaza', x: 0, z: -40 },
    drop: { label: 'Beachfront Hotel', x: 80, z: 104 },
    briefing: 'Madame Sari: "Downtown. A courier with a silver case. The beachfront hotel is expecting it — be fast."',
  },
  {
    id: 3, title: 'The Gold Sedan', pay: 900, time: 130,
    pickup: { label: 'Gold Sedan — Downtown', x: 40, z: 40 },
    drop: { label: 'Safehouse', x: -100, z: -92 },
    steal: true, heat: 3, stealColor: 0xd9a527,
    briefing: 'Madame Sari: "That gold sedan downtown is marked. Take it and reach the safehouse alive."',
  },
  {
    id: 4, title: 'Dockside Lift', pay: 1200, time: 110,
    pickup: { label: 'Container Yard', x: -140, z: 100 },
    drop: { label: 'Old Town Garage', x: 100, z: -40 },
    steal: true, heat: 2, stealColor: 0x3da55c,
    briefing: 'Madame Sari: "The containers at the dock hold more than fish. Lift the green car, lose the cruisers."',
  },
  {
    id: 5, title: 'Night Market Run', pay: 1400, time: 55,
    pickup: { label: 'Night Market', x: -80, z: 20 },
    drop: { label: 'Glass Tower', x: 40, z: -80 },
    heat: 1,
    drops: [
      { label: 'East Pier', x: 120, z: 40 },
      { label: 'North Gate', x: -40, z: -120 },
      { label: 'Glass Tower', x: 40, z: -80 },
    ],
    briefing: 'Madame Sari: "The market never sleeps and neither do the cops. Three drops, one night."',
  },
  {
    id: 6, title: 'The Rival', pay: 1600, time: 95,
    pickup: { label: 'Beachfront Strip', x: 0, z: 80 },
    drop: { label: 'North Gate', x: -40, z: -120 },
    race: true, rivalSpeed: 16.5,
    rivalRoute: [
      [0, 80],
      [0, -120],
      [-40, -120],
    ],
    briefing: 'Madame Sari: "Viko thinks he is the fastest wheel in the bay. Prove him wrong on the Beachfront Strip."',
  },
  {
    id: 7, title: 'The Debt Collector', pay: 1800, time: 125,
    pickup: { label: 'East Pier', x: 120, z: 0 },
    drop: { label: 'Safehouse', x: -100, z: -92 },
    heat: 3,
    briefing: 'Madame Sari: "A pickup waits at the East Pier. Grab it and run it to the safehouse — the heat will be on you."',
  },
  {
    id: 8, title: 'The Last Getaway', pay: 2500, time: 150,
    pickup: { label: 'Harbor Dock 2', x: -60, z: 106 },
    drop: { label: 'Beachfront Hotel', x: 80, z: 104 },
    heat: 5,
    briefing: 'Madame Sari: "One last job and the debt is gone. The harbor, five stars, and nobody follows us home."',
  },
];

// A row becomes a job object: a copy, so the run-time state missions.js
// hangs on it (phase, dropIndex, rival) never touches the table itself.
function buildJob(row) {
  return { ...row };
}

export const STORY = {
  hero: 'Dara',
  boss: 'Madame Sari',
  debt: 6400,
  jobs: JOB_TABLE.map(buildJob),
};
