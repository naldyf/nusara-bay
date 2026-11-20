// The story: Dara, a getaway driver, owes the harbor boss 8 jobs. Every job
// is pickup → timed drive → drop-off, and every job has its own twist — a
// steal, a three-stop run, a race, a getaway under full heat. Finish all
// eight and the $6,400 debt is gone.
//
// A job can carry extra fields:
//   steal — the pickup is a marked car; getting in it starts the escape
//   heat — wanted stars added the moment the cargo is picked up
//   drops — a list of drop-offs in order; time applies to each leg
//   race — Viko the rival drives the route too; beat him to the finish
//   stealColor — the marked car's paint
// Police-radio chatter for the dispatch panel, one line per wanted level.
// The HUD cycles them so the panel reads as a live radio, not a label.
export const DISPATCH_LINES = [
  [], // 0 stars — the panel is hidden
  ['"Unit 12, a 10-50 at the market — keep eyes on the sedan."'],
  ['"All units, suspect is mobile — eastbound on the bay road."'],
  ['"Roadblock on the north gate — spike strips ready."'],
  ['"Air One is up — spotlight on the suspect, do not lose visual."'],
  ['"Five stars — every unit in the bay converges on the harbor."'],
];

export const STORY = {
  hero: 'Dara',
  boss: 'Madame Sari',
  debt: 6400,
  jobs: [
    {
      id: 1,
      title: 'First Fare',
      briefing: 'Madame Sari: "A package is waiting at the night market. Bring it to the harbor. No questions, no stops."',
      pickup: { x: -80, z: -8, label: 'Night Market' },
      drop: { x: -60, z: 106, label: 'Harbor Dock 2' },
      time: 100,
      pay: 400,
    },
    {
      id: 2,
      title: 'The Courier',
      briefing: 'Madame Sari: "Downtown. A courier with a silver case. The hotel on the beachfront is expecting it — fast."',
      pickup: { x: 0, z: -40, label: 'Downtown Plaza' },
      drop: { x: 80, z: 104, label: 'Beachfront Hotel' },
      time: 85,
      pay: 600,
    },
    {
      id: 3,
      title: 'Lose the Heat',
      briefing: 'Madame Sari: "That gold sedan downtown is marked. Take it, lose the heat, and get to the safehouse alive."',
      pickup: { x: 40, z: 40, label: 'Gold Sedan — Downtown' },
      drop: { x: -100, z: -92, label: 'Safehouse' },
      time: 130,
      pay: 900,
      steal: true,
      heat: 3,
      stealColor: 0xd9a527,
    },
    {
      id: 4,
      title: 'Harbor Heist',
      briefing: 'Madame Sari: "Containers at the dock hold more than fish. Lift the crate truck, lose the cruisers."',
      pickup: { x: -140, z: 100, label: 'Container Yard' },
      drop: { x: 100, z: -40, label: 'Old Town Garage' },
      time: 110,
      pay: 1200,
      steal: true,
      heat: 2,
      stealColor: 0x3da55c,
    },
    {
      id: 5,
      title: 'Night Market Run',
      briefing: 'Madame Sari: "The market never sleeps and neither do the cops. Three drops, one night."',
      pickup: { x: -80, z: 20, label: 'Night Market' },
      drops: [
        { x: 120, z: 40, label: 'East Pier' },
        { x: -40, z: -120, label: 'North Gate' },
        { x: 40, z: -80, label: 'Glass Tower' },
      ],
      drop: { x: 40, z: -80, label: 'Glass Tower' },
      time: 55,
      pay: 1400,
      heat: 1,
    },
    {
      id: 6,
      title: 'The Rival',
      briefing: 'Madame Sari: "Viko thinks he is the fastest wheel in the bay. Prove him wrong — and take his car."',
      pickup: { x: 0, z: 80, label: 'Beachfront Strip' },
      drop: { x: -40, z: -120, label: 'North Gate' },
      time: 95,
      pay: 1600,
      race: true,
      rivalSpeed: 16.5,
      rivalRoute: [
        [0, 80],
        [0, -120],
        [-40, -120],
      ],
    },
    {
      id: 7,
      title: 'The Debt Collector',
      briefing: 'Madame Sari: "Someone is collecting from my people. Collect from him first — then run."',
      pickup: { x: 120, z: 0, label: 'East Pier' },
      drop: { x: -100, z: -92, label: 'Safehouse' },
      time: 125,
      pay: 1800,
      heat: 3,
    },
    {
      id: 8,
      title: 'The Last Getaway',
      briefing: 'Madame Sari: "One last job and the debt is gone. The harbor, five stars, and nobody follows us home."',
      pickup: { x: -60, z: 106, label: 'Harbor Dock 2' },
      drop: { x: 80, z: 104, label: 'Beachfront Hotel' },
      time: 150,
      pay: 2500,
      heat: 5,
    },
  ],
};
