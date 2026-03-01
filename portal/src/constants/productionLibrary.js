// Touring-grade equipment library, templates, and show-config defaults.

export const PROVIDER_OPTIONS = ['house', 'tour', 'promoter', 'tbd'];

export const SHOW_TYPE_OPTIONS = [
  { key: 'band', label: 'Band / Live Music' },
  { key: 'dj_electronic', label: 'DJ / Electronic' },
  { key: 'theater', label: 'Theater Troupe' },
  { key: 'speakers', label: 'Speakers / Workshop / Panel' },
  { key: 'orchestra_choir', label: 'Orchestra / Choir' },
  { key: 'hybrid', label: 'Hybrid Show' },
];

export const SHOW_TEMPLATE_OPTIONS = {
  band: [
    { key: 'solo_acoustic', label: 'Solo Acoustic', memberCount: 1 },
    { key: 'duo_acoustic', label: 'Duo Acoustic', memberCount: 2 },
    { key: 'trio', label: 'Trio', memberCount: 3 },
    { key: 'rock_4pc', label: '4-Piece Rock', memberCount: 4 },
    { key: 'rock_5plus', label: '5+ Piece Band', memberCount: 5 },
    { key: 'jazz_combo', label: 'Jazz Combo', memberCount: 5 },
  ],
  dj_electronic: [
    { key: 'dj_basic', label: 'DJ Basic' },
    { key: 'dj_hybrid_live', label: 'DJ + Live Elements' },
    { key: 'electronic_duo', label: 'Electronic Duo' },
  ],
  theater: [
    { key: 'straight_play', label: 'Straight Play' },
    { key: 'musical_with_band', label: 'Musical w/ Band' },
    { key: 'touring_theater', label: 'Touring Theater' },
  ],
  speakers: [
    { key: 'keynote', label: 'Keynote' },
    { key: 'panel', label: 'Panel Discussion' },
    { key: 'workshop', label: 'Workshop' },
    { key: 'graduation_style', label: 'Graduation-Style Program' },
  ],
  orchestra_choir: [
    { key: 'chamber_ensemble', label: 'Chamber Ensemble' },
    { key: 'choir_risers', label: 'Choir + Risers' },
    { key: 'orchestra_full', label: 'Full Orchestra' },
  ],
  hybrid: [
    { key: 'speakers_plus_band', label: 'Speakers + Band' },
    { key: 'theater_plus_live_music', label: 'Theater + Live Music' },
    { key: 'panel_plus_showcase', label: 'Panel + Showcase' },
  ],
};

export const EQUIPMENT_LIBRARY = {
  audioInputs: [
    { key: 'mic_dynamic_vocal', label: 'Dynamic Vocal Mic', category: 'audioInputs' },
    { key: 'mic_condenser_vocal', label: 'Condenser Vocal Mic', category: 'audioInputs' },
    { key: 'drum_kit_mic_pack', label: 'Drum Mic Pack (Kick/Snare/Toms/OH)', category: 'audioInputs' },
    { key: 'di_passive', label: 'Passive DI', category: 'audioInputs' },
    { key: 'di_active', label: 'Active DI', category: 'audioInputs' },
    { key: 'di_stereo', label: 'Stereo DI', category: 'audioInputs' },
    { key: 'wireless_handheld', label: 'Wireless Handheld', category: 'audioInputs' },
    { key: 'wireless_lav', label: 'Wireless Lavalier', category: 'audioInputs' },
    { key: 'wireless_headset', label: 'Wireless Headset', category: 'audioInputs' },
    { key: 'choir_hanging_mic', label: 'Choir / Hanging Mic', category: 'audioInputs' },
    { key: 'boundary_mic', label: 'Boundary Mic', category: 'audioInputs' },
    { key: 'talkback_mic', label: 'Talkback Mic', category: 'audioInputs' },
    { key: 'lectern_mic', label: 'Lectern Mic', category: 'audioInputs' },
  ],
  standsMounts: [
    { key: 'stand_straight', label: 'Mic Stand - Straight', category: 'standsMounts' },
    { key: 'stand_boom', label: 'Mic Stand - Boom', category: 'standsMounts' },
    { key: 'stand_short_boom', label: 'Mic Stand - Short Boom', category: 'standsMounts' },
    { key: 'stand_tall_boom', label: 'Mic Stand - Tall Boom', category: 'standsMounts' },
    { key: 'stereo_bar', label: 'Stereo Bar', category: 'standsMounts' },
    { key: 'drum_clip_mount', label: 'Drum Clip Mount', category: 'standsMounts' },
    { key: 'music_stand', label: 'Music Stand', category: 'standsMounts' },
    { key: 'tablet_mount', label: 'Tablet / iPad Mount', category: 'standsMounts' },
  ],
  cablesConnectivity: [
    { key: 'xlr_25', label: 'XLR 25ft', category: 'cablesConnectivity' },
    { key: 'xlr_50', label: 'XLR 50ft', category: 'cablesConnectivity' },
    { key: 'trs', label: 'TRS', category: 'cablesConnectivity' },
    { key: 'ts', label: 'TS Instrument Cable', category: 'cablesConnectivity' },
    { key: 'speakon', label: 'Speakon', category: 'cablesConnectivity' },
    { key: 'powercon', label: 'powerCON', category: 'cablesConnectivity' },
    { key: 'iec', label: 'IEC Power', category: 'cablesConnectivity' },
    { key: 'ethernet_cat6', label: 'Ethernet Cat6', category: 'cablesConnectivity' },
    { key: 'dmx', label: 'DMX', category: 'cablesConnectivity' },
    { key: 'hdmi', label: 'HDMI', category: 'cablesConnectivity' },
    { key: 'sdi', label: 'SDI', category: 'cablesConnectivity' },
    { key: 'usb_c_adapter', label: 'USB-C Adapters', category: 'cablesConnectivity' },
  ],
  monitoring: [
    { key: 'wedge_monitor', label: 'Wedge Monitor', category: 'monitoring' },
    { key: 'side_fill', label: 'Side Fill', category: 'monitoring' },
    { key: 'iem_tx', label: 'IEM Transmitter', category: 'monitoring' },
    { key: 'iem_wired_pack', label: 'Wired IEM Pack', category: 'monitoring' },
    { key: 'drummer_throne_buttkicker', label: 'Drummer Tactile Monitor', category: 'monitoring' },
    { key: 'monitor_mix_bus', label: 'Monitor Mix Bus', category: 'monitoring' },
  ],
  consolesStageBoxes: [
    { key: 'console_digital_32', label: 'Digital Console 32ch+', category: 'consolesStageBoxes' },
    { key: 'console_digital_16', label: 'Digital Console 16ch+', category: 'consolesStageBoxes' },
    { key: 'stage_rack', label: 'Digital Stage Rack', category: 'consolesStageBoxes' },
    { key: 'analog_snake', label: 'Analog Snake', category: 'consolesStageBoxes' },
    { key: 'dante_network', label: 'Dante Network', category: 'consolesStageBoxes' },
    { key: 'splitter_snake', label: 'Splitter Snake', category: 'consolesStageBoxes' },
  ],
  backline: [
    { key: 'drum_kit_5pc', label: 'Drum Kit (5pc)', category: 'backline' },
    { key: 'drum_riser', label: 'Drum Riser', category: 'backline' },
    { key: 'guitar_amp', label: 'Guitar Amp', category: 'backline' },
    { key: 'bass_amp', label: 'Bass Amp', category: 'backline' },
    { key: 'keys_88', label: '88-key Keyboard', category: 'backline' },
    { key: 'keyboard_stand', label: 'Keyboard Stand', category: 'backline' },
    { key: 'percussion_rig', label: 'Percussion Rig', category: 'backline' },
    { key: 'utility_riser', label: 'Utility Riser', category: 'backline' },
    { key: 'chair', label: 'Chair', category: 'backline' },
    { key: 'music_stand', label: 'Music Stand', category: 'backline' },
    { key: 'dj_table', label: 'DJ Table', category: 'backline' },
  ],
  lighting: [
    { key: 'front_wash', label: 'Front Wash', category: 'lighting' },
    { key: 'back_wash', label: 'Back Wash', category: 'lighting' },
    { key: 'specials', label: 'Spot Specials', category: 'lighting' },
    { key: 'movers', label: 'Moving Fixtures', category: 'lighting' },
    { key: 'followspot', label: 'Followspot', category: 'lighting' },
    { key: 'hazer', label: 'Hazer (Optional)', category: 'lighting' },
    { key: 'dmx_universe', label: 'DMX Universe', category: 'lighting' },
    { key: 'cue_stack', label: 'Cue Stack Programming', category: 'lighting' },
  ],
  video: [
    { key: 'projector', label: 'Projector', category: 'video' },
    { key: 'projection_screen', label: 'Projection Screen', category: 'video' },
    { key: 'switcher', label: 'Video Switcher', category: 'video' },
    { key: 'confidence_monitor', label: 'Confidence Monitor', category: 'video' },
    { key: 'camera_feed', label: 'Camera Feed', category: 'video' },
    { key: 'recording_iso', label: 'ISO Recording', category: 'video' },
  ],
  power: [
    { key: 'power_drop_sl', label: 'Power Drop - Stage Left', category: 'power' },
    { key: 'power_drop_sr', label: 'Power Drop - Stage Right', category: 'power' },
    { key: 'power_drop_center', label: 'Power Drop - Center', category: 'power' },
    { key: 'audio_dedicated_circuit', label: 'Dedicated Audio Circuit', category: 'power' },
    { key: 'lighting_dedicated_circuit', label: 'Dedicated Lighting Circuit', category: 'power' },
    { key: 'video_dedicated_circuit', label: 'Dedicated Video Circuit', category: 'power' },
    { key: 'distro_120v', label: '120V Distro', category: 'power' },
    { key: 'distro_208v', label: '208V Distro', category: 'power' },
    { key: 'distro_240v', label: '240V Distro', category: 'power' },
  ],
  stageManagement: [
    { key: 'comms_headsets', label: 'Comms Headsets', category: 'stageManagement' },
    { key: 'cue_lights', label: 'Cue Lights', category: 'stageManagement' },
    { key: 'backstage_video', label: 'Backstage Program Monitor', category: 'stageManagement' },
    { key: 'show_call_console', label: 'Show Call Console', category: 'stageManagement' },
    { key: 'clearcom_partyline', label: 'Partyline / Comms Matrix', category: 'stageManagement' },
    { key: 'sm_desk', label: 'Stage Manager Desk', category: 'stageManagement' },
  ],
};

export const STAGE_PLOT_ITEM_LIBRARY = [
  // Physical + structural
  { type: 'set_piece', label: 'Set Piece', w: 3, h: 2, category: 'physical' },
  { type: 'riser', label: 'Riser', w: 3, h: 2, category: 'physical' },
  { type: 'orchestra_pit', label: 'Orchestra Pit', w: 4, h: 2, category: 'physical' },
  { type: 'trap_door', label: 'Trap Door', w: 1, h: 1, category: 'physical' },
  { type: 'scrim', label: 'Scrim', w: 4, h: 1, category: 'physical' },
  { type: 'cyc', label: 'Cyc', w: 4, h: 1, category: 'physical' },
  { type: 'apron', label: 'Apron', w: 4, h: 1, category: 'physical' },
  { type: 'column', label: 'Structural Column', w: 1, h: 1, category: 'physical' },
  { type: 'wall_segment', label: 'Wall Segment', w: 4, h: 1, category: 'physical' },
  { type: 'window_segment', label: 'Window Segment', w: 2, h: 1, category: 'physical' },
  { type: 'fixed_bar', label: 'Fixed Bar', w: 3, h: 1, category: 'physical' },

  // Doors + safety + egress
  {
    type: 'door_standard',
    label: 'Door (Standard)',
    w: 1,
    h: 1,
    category: 'safety',
    isDoor: true,
    defaultDoorWidthFeet: 3,
    defaultEntryType: 'public',
  },
  {
    type: 'door_double',
    label: 'Door (Double)',
    w: 2,
    h: 1,
    category: 'safety',
    isDoor: true,
    isDoubleDoor: true,
    defaultDoorWidthFeet: 6,
    defaultEntryType: 'public',
  },
  {
    type: 'door_rollup',
    label: 'Door (Roll-up)',
    w: 3,
    h: 1,
    category: 'safety',
    isDoor: true,
    isRollUpDoor: true,
    defaultDoorWidthFeet: 8,
    defaultEntryType: 'boh',
  },
  {
    type: 'door_emergency_exit',
    label: 'Emergency Exit',
    w: 1,
    h: 1,
    category: 'safety',
    isDoor: true,
    isEmergencyExit: true,
    defaultDoorWidthFeet: 3,
    defaultEntryType: 'emergency',
  },
  {
    type: 'door_ada_entry',
    label: 'ADA Entry',
    w: 1,
    h: 1,
    category: 'safety',
    isDoor: true,
    isADA: true,
    defaultDoorWidthFeet: 4,
    defaultEntryType: 'public',
  },
  { type: 'fire_extinguisher', label: 'Fire Extinguisher', w: 1, h: 1, category: 'safety' },
  { type: 'aed_station', label: 'AED Station', w: 1, h: 1, category: 'safety' },
  { type: 'first_aid_station', label: 'First Aid Station', w: 2, h: 1, category: 'safety' },
  { type: 'barricade_line', label: 'Barricade Line', w: 3, h: 1, category: 'safety' },
  { type: 'emergency_assembly_point', label: 'Emergency Assembly Point', w: 2, h: 1, category: 'safety' },
  { type: 'command_post', label: 'Command Post', w: 2, h: 1, category: 'safety', powerRequired: true, defaultWattage: 180 },
  { type: 'hydration_station', label: 'Hydration Station', w: 2, h: 1, category: 'weather' },
  { type: 'cooling_station', label: 'Cooling Station', w: 2, h: 1, category: 'weather', powerRequired: true, defaultWattage: 250 },
  { type: 'weather_monitor_post', label: 'Weather Monitor Post', w: 1, h: 1, category: 'weather', powerRequired: true, defaultWattage: 80 },
  { type: 'evacuation_shelter', label: 'Evacuation Shelter Zone', w: 3, h: 2, category: 'weather' },
  { type: 'camera_fixed', label: 'Fixed Camera', w: 1, h: 1, category: 'surveillance', powerRequired: true, defaultWattage: 40 },
  { type: 'camera_ptz', label: 'PTZ Camera', w: 1, h: 1, category: 'surveillance', powerRequired: true, defaultWattage: 60 },
  { type: 'camera_dome', label: 'Dome Camera', w: 1, h: 1, category: 'surveillance', powerRequired: true, defaultWattage: 35 },
  { type: 'camera_temp_event', label: 'Temporary Event Camera', w: 1, h: 1, category: 'surveillance', powerRequired: true, defaultWattage: 50 },
  { type: 'body_cam_station', label: 'Body Cam Station', w: 1, h: 1, category: 'surveillance', powerRequired: true, defaultWattage: 90 },
  { type: 'drone_zone', label: 'Drone Ops Zone', w: 2, h: 2, category: 'surveillance' },
  { type: 'bag_check_station', label: 'Bag Check Station', w: 2, h: 1, category: 'access_control' },
  { type: 'metal_detector_lane', label: 'Metal Detector Lane', w: 2, h: 1, category: 'access_control', powerRequired: true, defaultWattage: 120 },
  { type: 'hand_wand_point', label: 'Hand Wand Point', w: 1, h: 1, category: 'access_control' },
  { type: 'id_check_desk', label: 'ID Check Desk', w: 2, h: 1, category: 'access_control' },
  { type: 'credential_checkpoint', label: 'Credential Checkpoint', w: 2, h: 1, category: 'access_control' },
  { type: 'rfid_turnstile', label: 'RFID Turnstile', w: 1, h: 1, category: 'access_control', powerRequired: true, defaultWattage: 120 },
  { type: 'vip_access_lane', label: 'VIP Access Lane', w: 2, h: 1, category: 'access_control' },

  // Audio + stage
  { type: 'mic_dynamic', label: 'Vocal Mic (Dynamic)', w: 1, h: 1, category: 'sound' },
  { type: 'mic_wireless', label: 'Vocal Mic (Wireless)', w: 1, h: 1, category: 'sound' },
  { type: 'overhead_mic', label: 'Overhead Mic', w: 1, h: 1, category: 'sound' },
  { type: 'boundary_mic', label: 'Boundary Mic', w: 1, h: 1, category: 'sound' },
  { type: 'talkback_mic', label: 'Talkback Mic', w: 1, h: 1, category: 'sound' },
  { type: 'wedge', label: 'Monitor Wedge', w: 1, h: 1, category: 'sound', powerRequired: true, defaultWattage: 280 },
  { type: 'side_fill', label: 'Side Fill', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 800 },
  { type: 'iem', label: 'IEM Tx', w: 1, h: 1, category: 'sound', powerRequired: true, defaultWattage: 60 },
  { type: 'drums', label: 'Drum Kit', w: 3, h: 2, category: 'sound' },
  { type: 'guitar_amp', label: 'Guitar Amp', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 220 },
  { type: 'bass_amp', label: 'Bass Amp', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 350 },
  { type: 'keyboard', label: 'Keyboard Rig', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 180 },
  { type: 'foh_mix', label: 'FOH Mix Position', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 480 },
  { type: 'monitor_world', label: 'Monitor World Rack', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 520 },
  { type: 'powered_speaker', label: 'Powered Speaker', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 950 },
  { type: 'subwoofer', label: 'Subwoofer', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 1200 },
  { type: 'playback_rig', label: 'Playback Computer Rig', w: 1, h: 1, category: 'sound', powerRequired: true, defaultWattage: 160 },
  { type: 'house_main_array', label: 'House Main Array', w: 3, h: 1, category: 'sound', powerRequired: true, defaultWattage: 1600, defaultLayer: 'house' },
  { type: 'house_sub_cluster', label: 'House Sub Cluster', w: 2, h: 1, category: 'sound', powerRequired: true, defaultWattage: 1400, defaultLayer: 'house' },
  { type: 'house_fill', label: 'House Fill Speaker', w: 1, h: 1, category: 'sound', powerRequired: true, defaultWattage: 280, defaultLayer: 'house' },
  { type: 'house_delay', label: 'House Delay Speaker', w: 1, h: 1, category: 'sound', powerRequired: true, defaultWattage: 240, defaultLayer: 'house' },
  { type: 'stage_box_house', label: 'House Stage Box', w: 1, h: 1, category: 'sound', defaultLayer: 'house' },
  { type: 'house_patch_panel', label: 'House Patch Panel', w: 1, h: 1, category: 'sound', defaultLayer: 'house' },
  { type: 'house_console_pos', label: 'House Console Position', w: 2, h: 1, category: 'sound', defaultLayer: 'house' },

  // Lighting
  { type: 'lx_foh_1', label: 'FOH 1 Position', w: 2, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_foh_2', label: 'FOH 2 Position', w: 2, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_balcony_rail', label: 'Balcony Rail Position', w: 2, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_first_electric', label: '1st Electric', w: 3, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_second_electric', label: '2nd Electric', w: 3, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_third_electric', label: '3rd Electric', w: 3, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_box_boom_sl', label: 'Box Boom SL', w: 1, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_box_boom_sr', label: 'Box Boom SR', w: 1, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_ground_row', label: 'Ground Row', w: 3, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_catwalk', label: 'Catwalk Position', w: 3, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_grid_pipe', label: 'Grid Pipe', w: 3, h: 1, category: 'lighting', defaultLayer: 'house' },
  { type: 'lx_electric', label: 'LX Electric Position', w: 3, h: 1, category: 'lighting' },
  { type: 'lx_boom', label: 'Boom Position', w: 1, h: 1, category: 'lighting' },
  { type: 'led_fixture', label: 'LED Fixture Cluster', w: 1, h: 1, category: 'lighting', powerRequired: true, defaultWattage: 180 },
  { type: 'moving_light', label: 'Moving Light Cluster', w: 2, h: 1, category: 'lighting', powerRequired: true, defaultWattage: 700, defaultVoltage: '208V' },
  { type: 'practical_lamp', label: 'Practical Lamp', w: 1, h: 1, category: 'lighting', powerRequired: true, defaultWattage: 75 },
  { type: 'hazer', label: 'Hazer / Fogger', w: 1, h: 1, category: 'lighting', powerRequired: true, defaultWattage: 1300 },
  { type: 'dimmer_rack', label: 'Lighting Dimmer Rack', w: 2, h: 1, category: 'lighting', powerRequired: true, defaultWattage: 2400, defaultVoltage: '208V' },

  // Ops + conference/workshop/gallery/vendor
  { type: 'lectern', label: 'Podium / Lectern', w: 1, h: 1, category: 'operations', powerRequired: true, defaultWattage: 60 },
  { type: 'chair', label: 'Chair', w: 1, h: 1, category: 'operations' },
  { type: 'music_stand', label: 'Music Stand', w: 1, h: 1, category: 'operations' },
  { type: 'projector_screen', label: 'Projection Screen', w: 3, h: 1, category: 'operations' },
  { type: 'projector', label: 'Projector', w: 2, h: 1, category: 'operations', powerRequired: true, defaultWattage: 500 },
  { type: 'dj_table', label: 'DJ Table', w: 2, h: 1, category: 'operations', powerRequired: true, defaultWattage: 260 },
  { type: 'fx_table', label: 'FX Table', w: 2, h: 1, category: 'operations', powerRequired: true, defaultWattage: 220 },
  { type: 'table_6ft', label: 'Table (6ft)', w: 3, h: 1, category: 'operations' },
  { type: 'pedestal', label: 'Pedestal', w: 1, h: 1, category: 'operations' },
  { type: 'vendor_booth', label: 'Vendor Booth', w: 3, h: 2, category: 'operations', powerRequired: true, defaultWattage: 300 },
  { type: 'pos_station', label: 'POS Station', w: 1, h: 1, category: 'operations', powerRequired: true, defaultWattage: 90 },
  { type: 'charging_station', label: 'Charging Station', w: 2, h: 1, category: 'operations', powerRequired: true, defaultWattage: 250 },
  { type: 'yoga_mat', label: 'Yoga Mat', w: 2, h: 1, category: 'operations' },

  // Gallery / art show artifact types
  { type: 'painting_framed', label: 'Painting (Framed)', w: 2, h: 1, category: 'operations' },
  { type: 'painting_unframed', label: 'Painting (Unframed)', w: 2, h: 1, category: 'operations' },
  { type: 'photograph_framed', label: 'Photograph (Framed)', w: 2, h: 1, category: 'operations' },
  { type: 'prints_wall', label: 'Prints (Wall Display)', w: 2, h: 1, category: 'operations' },
  { type: 'prints_bin', label: 'Prints (Bin Display)', w: 2, h: 1, category: 'operations' },
  { type: 'ceramics_small', label: 'Ceramics (Small)', w: 1, h: 1, category: 'operations' },
  { type: 'ceramics_medium', label: 'Ceramics (Medium)', w: 1, h: 1, category: 'operations' },
  { type: 'ceramics_large', label: 'Ceramics (Large)', w: 2, h: 2, category: 'operations' },
  { type: 'sculpture_floor', label: 'Sculpture (Floor Footprint)', w: 2, h: 2, category: 'operations' },
  { type: 'mixed_media_piece', label: 'Mixed Media / Assemblage', w: 2, h: 1, category: 'operations' },
  { type: 'textile_fiber_piece', label: 'Textile / Fiber Art', w: 2, h: 1, category: 'operations' },
  { type: 'jewelry_display_case', label: 'Jewelry Display', w: 2, h: 1, category: 'operations' },
  { type: 'zines_books_table', label: 'Zines / Books Table', w: 2, h: 1, category: 'operations' },
  { type: 'digital_video_piece', label: 'Digital / Video Piece', w: 2, h: 1, category: 'operations', powerRequired: true, defaultWattage: 300 },

  // Gallery / pop-up display methods
  { type: 'wall_hung_display', label: 'Wall-Hung Display', w: 2, h: 1, category: 'operations' },
  { type: 'easel_display', label: 'Easel Display', w: 1, h: 2, category: 'operations' },
  { type: 'table_display', label: 'Table Display', w: 2, h: 1, category: 'operations' },
  { type: 'shelf_display', label: 'Shelf Display', w: 2, h: 1, category: 'operations' },
  { type: 'plinth_display', label: 'Plinth / Pedestal Display', w: 1, h: 1, category: 'operations' },
  { type: 'display_case', label: 'Display Case', w: 2, h: 1, category: 'operations' },
  { type: 'gridwall_panel', label: 'Gridwall Panel', w: 2, h: 1, category: 'operations' },
  { type: 'hanging_rail', label: 'Hanging Rail System', w: 3, h: 1, category: 'operations' },

  // Gallery installation + operations objects
  { type: 'price_sign_stand', label: 'Price List / Signage Stand', w: 1, h: 1, category: 'operations' },
  { type: 'qr_code_sign', label: 'QR Code Sign', w: 1, h: 1, category: 'operations' },
  { type: 'checkout_station', label: 'Checkout / POS Station', w: 2, h: 1, category: 'operations', powerRequired: true, defaultWattage: 120 },
  { type: 'packaging_station', label: 'Packaging Station', w: 2, h: 1, category: 'operations' },
  { type: 'storage_bins_under_table', label: 'Storage Bins (Under-table)', w: 2, h: 1, category: 'operations' },
  { type: 'lighting_clip_spots', label: 'Lighting Clip Spots', w: 1, h: 1, category: 'lighting', powerRequired: true, defaultWattage: 80 },
  { type: 'display_lighting_power_drop', label: 'Display Lighting Power Drop', w: 1, h: 1, category: 'power', isElectricalSource: true, defaultVoltage: '120V', defaultAmperage: 20 },
  { type: 'queue_stanchions', label: 'Queue Stanchions', w: 2, h: 1, category: 'operations' },

  // Projection / video department
  { type: 'video_projector_front', label: 'Projector (Front)', w: 2, h: 1, category: 'video', powerRequired: true, defaultWattage: 650 },
  { type: 'video_projector_rear', label: 'Projector (Rear)', w: 2, h: 1, category: 'video', powerRequired: true, defaultWattage: 650 },
  { type: 'video_screen', label: 'Video Screen', w: 3, h: 1, category: 'video' },
  { type: 'video_led_wall', label: 'LED Wall', w: 4, h: 2, category: 'video', powerRequired: true, defaultWattage: 2200, defaultVoltage: '208V' },
  { type: 'video_tv_monitor', label: 'TV Monitor', w: 2, h: 1, category: 'video', powerRequired: true, defaultWattage: 180 },
  { type: 'video_camera_imag', label: 'Camera (IMAG)', w: 1, h: 1, category: 'video', powerRequired: true, defaultWattage: 90 },
  { type: 'video_media_server', label: 'Media Server / Playback Laptop', w: 2, h: 1, category: 'video', powerRequired: true, defaultWattage: 240 },
  { type: 'video_switcher', label: 'Video Switcher', w: 2, h: 1, category: 'video', powerRequired: true, defaultWattage: 280 },
  { type: 'video_routing_node', label: 'SDI / HDMI / NDI Routing Node', w: 1, h: 1, category: 'video', powerRequired: true, defaultWattage: 120 },
  { type: 'video_village', label: 'Video Village / Monitor Station', w: 3, h: 1, category: 'video', powerRequired: true, defaultWattage: 320 },
  { type: 'video_confidence_monitor', label: 'Confidence Monitor', w: 2, h: 1, category: 'video', powerRequired: true, defaultWattage: 160 },
  { type: 'video_teleprompter', label: 'Teleprompter', w: 1, h: 1, category: 'video', powerRequired: true, defaultWattage: 120 },

  // Power + electrical sources/distribution
  {
    type: 'outlet_20a',
    label: '20A Outlet',
    w: 1,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '120V',
    defaultAmperage: 20,
  },
  {
    type: 'outlet_30a',
    label: '30A Outlet',
    w: 1,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '120V',
    defaultAmperage: 30,
  },
  {
    type: 'outlet_50a',
    label: '50A Outlet',
    w: 1,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '240V',
    defaultAmperage: 50,
  },
  {
    type: 'camlock_100a',
    label: '100A Camlock',
    w: 2,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '3-Phase',
    defaultAmperage: 100,
  },
  {
    type: 'service_3phase',
    label: '3-Phase Service',
    w: 2,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '3-Phase',
    defaultAmperage: 200,
  },
  {
    type: 'power_distro',
    label: 'Power Distro Box',
    w: 2,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '208V',
    defaultAmperage: 100,
  },
  {
    type: 'breaker_panel',
    label: 'Breaker Panel',
    w: 2,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '208V',
    defaultAmperage: 200,
  },
  {
    type: 'generator',
    label: 'Generator',
    w: 3,
    h: 2,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '3-Phase',
    defaultAmperage: 300,
  },
  { type: 'extension_run', label: 'Extension Run', w: 2, h: 1, category: 'power' },
  { type: 'power_strip', label: 'Power Strip', w: 1, h: 1, category: 'power', isElectricalSource: true, defaultVoltage: '120V', defaultAmperage: 15 },
  {
    type: 'company_switch',
    label: 'Company Switch',
    w: 2,
    h: 1,
    category: 'power',
    isElectricalSource: true,
    defaultVoltage: '3-Phase',
    defaultAmperage: 400,
  },

  // Comms
  { type: 'sm_desk', label: 'SM Desk', w: 2, h: 1, category: 'comms', powerRequired: true, defaultWattage: 120 },
  { type: 'clearcom_base', label: 'Clear-Com Base', w: 1, h: 1, category: 'comms', powerRequired: true, defaultWattage: 150 },
  { type: 'headset_pack', label: 'Headset Belt Pack', w: 1, h: 1, category: 'comms', powerRequired: true, defaultWattage: 15 },
  { type: 'walkie_bank', label: 'Walkie Charging Bank', w: 1, h: 1, category: 'comms', powerRequired: true, defaultWattage: 90 },
  { type: 'cue_light', label: 'Cue Light', w: 1, h: 1, category: 'comms', powerRequired: true, defaultWattage: 20 },
];

function includeItems(keys = []) {
  const all = Object.values(EQUIPMENT_LIBRARY).flat();
  return keys.map((key) => {
    const found = all.find(item => item.key === key);
    return found ? { ...found, provider: 'tbd', quantity: 1, notes: '' } : null;
  }).filter(Boolean);
}

function makeInput(label, source, qty = 1) {
  return { label, source, quantity: qty, phantom: false, notes: '' };
}

function makeMonitor(name, channels = '') {
  return { name, channels, type: 'wedge', notes: '' };
}

function makePower(label, location) {
  return { label, location, voltage: '120V', dedicated: false, provider: 'tbd', notes: '' };
}

export function buildShowConfigurationDefaults({ showType = 'band', templateKey = '', answers = {} }) {
  const memberCount = Number(answers.memberCount || answers.castSize || answers.speakerCount || 0);
  const wirelessCount = Number(answers.wirelessCount || 0);
  const panelCount = Number(answers.panelCount || 0);
  const choirSize = Number(answers.choirSize || 0);

  if (showType === 'theater') {
    const castSize = memberCount || 8;
    return {
      showType,
      templateKey,
      memberCount: castSize,
      summary: `${castSize}-person theater configuration`,
      equipment: includeItems(['wireless_headset', 'comms_headsets', 'cue_lights', 'backstage_video', 'projector']),
      inputList: [
        makeInput('Playback L', 'QLab'),
        makeInput('Playback R', 'QLab'),
        makeInput('SM Talkback', 'SM Desk'),
        makeInput('Orchestra Pit L', 'Pit'),
        makeInput('Orchestra Pit R', 'Pit'),
      ],
      patchList: [
        { channel: 1, source: 'Playback L', destination: 'FOH', notes: '' },
        { channel: 2, source: 'Playback R', destination: 'FOH', notes: '' },
      ],
      monitorPlan: [
        makeMonitor('SM Cue', 'Comms'),
        makeMonitor('Backstage Program', 'Program Feed'),
      ],
      backline: [],
      lightingPlan: includeItems(['front_wash', 'specials', 'cue_stack', 'dmx_universe']),
      videoPlan: includeItems(['projector', 'projection_screen', 'confidence_monitor']),
      powerPlan: [
        makePower('SM Desk', 'Backstage'),
        makePower('Playback Rack', 'Booth'),
      ],
      stageManagement: includeItems(['comms_headsets', 'cue_lights', 'show_call_console']),
      plotSummary: `Cast size ${castSize}. Wireless count ${wirelessCount || 'TBD'}.`,
      stagePlotLayout: { width: 24, depth: 16, items: [] },
    };
  }

  if (showType === 'speakers') {
    const speakerCount = memberCount || panelCount || 2;
    return {
      showType,
      templateKey,
      memberCount: speakerCount,
      summary: `${speakerCount}-speaker program`,
      equipment: includeItems(['wireless_lav', 'wireless_handheld', 'lectern_mic', 'projector', 'confidence_monitor']),
      inputList: [
        makeInput('Lectern Mic', 'Lectern'),
        makeInput('Playback L', 'Presentation Laptop'),
        makeInput('Playback R', 'Presentation Laptop'),
        makeInput('Q&A Wireless 1', 'Audience'),
        makeInput('Q&A Wireless 2', 'Audience'),
      ],
      patchList: [],
      monitorPlan: [makeMonitor('Presenter Foldback', 'Program')],
      backline: [],
      lightingPlan: includeItems(['front_wash', 'specials']),
      videoPlan: includeItems(['projector', 'projection_screen', 'switcher']),
      powerPlan: [
        makePower('Lectern', 'Center'),
        makePower('Presenter Table', 'Stage Right'),
      ],
      stageManagement: includeItems(['comms_headsets']),
      plotSummary: `Speaker count ${speakerCount}.`,
      stagePlotLayout: { width: 24, depth: 16, items: [] },
    };
  }

  if (showType === 'orchestra_choir') {
    const ensembleSize = memberCount || choirSize || 24;
    return {
      showType,
      templateKey,
      memberCount: ensembleSize,
      summary: `${ensembleSize}-member orchestral/choral layout`,
      equipment: includeItems(['choir_hanging_mic', 'music_stand', 'riser', 'talkback_mic']),
      inputList: [
        makeInput('Conductor Talkback', 'Podium'),
        makeInput('Choir Section L', 'Choir L'),
        makeInput('Choir Section R', 'Choir R'),
        makeInput('Orchestra Main L', 'Main'),
        makeInput('Orchestra Main R', 'Main'),
      ],
      patchList: [],
      monitorPlan: [makeMonitor('Conductor Foldback', 'Program / Talkback')],
      backline: includeItems(['chair', 'music_stand']),
      lightingPlan: includeItems(['front_wash', 'specials']),
      videoPlan: [],
      powerPlan: [makePower('Conductor Podium', 'Downstage Center')],
      stageManagement: includeItems(['comms_headsets']),
      plotSummary: `Ensemble size ${ensembleSize}.`,
      stagePlotLayout: { width: 30, depth: 20, items: [] },
    };
  }

  if (showType === 'dj_electronic') {
    return {
      showType,
      templateKey,
      memberCount: memberCount || 1,
      summary: 'DJ / electronic performance configuration',
      equipment: includeItems(['di_stereo', 'dj_table', 'wedge_monitor', 'distro_120v']),
      inputList: [
        makeInput('DJ L', 'Controller'),
        makeInput('DJ R', 'Controller'),
        makeInput('Talkback Mic', 'DJ Booth'),
      ],
      patchList: [],
      monitorPlan: [makeMonitor('DJ Booth', 'Stereo')],
      backline: includeItems(['dj_table']),
      lightingPlan: includeItems(['movers', 'front_wash', 'hazer']),
      videoPlan: [],
      powerPlan: [
        makePower('DJ Table', 'Center'),
        makePower('FX Rack', 'Stage Right'),
      ],
      stageManagement: [],
      plotSummary: 'Stereo DJ setup with booth monitoring.',
      stagePlotLayout: { width: 20, depth: 14, items: [] },
    };
  }

  if (showType === 'hybrid') {
    const moduleDefaults = buildShowConfigurationDefaults({
      showType: answers.hybridBase || 'band',
      templateKey,
      answers,
    });
    const speakerDefaults = buildShowConfigurationDefaults({
      showType: 'speakers',
      templateKey: 'panel',
      answers,
    });
    return {
      ...moduleDefaults,
      showType,
      summary: `Hybrid setup (${moduleDefaults.summary}) + speaker module`,
      inputList: [...moduleDefaults.inputList, ...speakerDefaults.inputList],
      videoPlan: [...moduleDefaults.videoPlan, ...speakerDefaults.videoPlan],
      stageManagement: [...moduleDefaults.stageManagement, ...speakerDefaults.stageManagement],
      plotSummary: `${moduleDefaults.plotSummary} Includes speaker/panel segment.`,
    };
  }

  // Default to band/live music templates.
  const bandSize = memberCount || (templateKey === 'solo_acoustic' ? 1 : templateKey === 'duo_acoustic' ? 2 : templateKey === 'trio' ? 3 : templateKey === 'rock_4pc' ? 4 : 5);
  const monitorMixes = Math.min(Math.max(bandSize, 1), 8);
  return {
    showType: 'band',
    templateKey,
    memberCount: bandSize,
    summary: `${bandSize}-member band configuration`,
    equipment: includeItems(['mic_dynamic_vocal', 'di_active', 'wedge_monitor', 'guitar_amp', 'bass_amp', 'drum_kit_5pc']),
    inputList: [
      makeInput('Lead Vocal', 'Mic'),
      makeInput('Guitar Amp', 'Mic'),
      makeInput('Bass DI', 'DI'),
      makeInput('Keys L', 'DI'),
      makeInput('Keys R', 'DI'),
      makeInput('Kick', 'Drums'),
      makeInput('Snare', 'Drums'),
      makeInput('OH L', 'Drums'),
      makeInput('OH R', 'Drums'),
    ],
    patchList: [],
    monitorPlan: Array.from({ length: monitorMixes }, (_, idx) => makeMonitor(`Mix ${idx + 1}`, 'Vox/Band')),
    backline: includeItems(['guitar_amp', 'bass_amp', 'drum_kit_5pc', 'keyboard_stand']),
    lightingPlan: includeItems(['front_wash', 'specials']),
    videoPlan: [],
    powerPlan: [
      makePower('Backline SL', 'Stage Left'),
      makePower('Backline SR', 'Stage Right'),
      makePower('Pedalboards', 'Downstage'),
    ],
    stageManagement: includeItems(['comms_headsets']),
    plotSummary: `${bandSize}-piece band. Monitor mixes: ${monitorMixes}.`,
    stagePlotLayout: { width: 24, depth: 16, items: [] },
  };
}
