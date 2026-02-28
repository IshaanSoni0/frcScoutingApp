import React, { useState } from 'react';
import { Match, User } from '../types';
import { readableMatchLabel } from '../utils/match';
import { DataService } from '../services/dataService';
import { Save, ArrowLeft, Wifi, WifiOff } from 'lucide-react';

interface ScoutingFormProps {
  match: Match;
  user: User;
  onBack: () => void;
  onSubmit: () => void;
  existing?: any;
}

export function ScoutingForm({ match, user, onBack, onSubmit, existing }: ScoutingFormProps) {
  const [formData, setFormData] = useState(() => ({
    auto: { fuel: 0, neutralZone: false, depot: false, outpost: false, climbed: false },
    teleop: {
      transition: { fuel: 0, neutralZone: false, depot: false, outpost: false },
      firstOffence: { fuel: 0, neutralZone: false, depot: false, outpost: false, launchedToSide: false },
      endgame: { fuel: 0, neutralZone: false, depot: false, outpost: false, launchedToSide: false },
      firstDefense: { defense: 'na' as 'na' | 'bad' | 'average' | 'good', neutralZone: false, depot: false, outpost: false, launchedToSide: false },
      secondOffence: { fuel: 0, neutralZone: false, depot: false, outpost: false, launchedToSide: false },
      secondDefense: { defense: 'na' as 'na' | 'bad' | 'average' | 'good', neutralZone: false, depot: false, outpost: false, launchedToSide: false },
    },
    endgame: {
      trench: 'na' as 'yes' | 'no' | 'na',
      climb: 'none' as 'none' | 'level1' | 'level2' | 'level3',
      shootingAccuracy: 'na' as 'na' | 'very_inaccurate' | 'inaccurate' | 'moderately_accurate' | 'accurate' | 'very_accurate',
      shootingSpeed: 'na' as 'na' | 'very_slow' | 'slow' | 'average' | 'moderately_fast' | 'very_fast',
      intakeSpeed: 'na' as 'na' | 'very_slow' | 'slow' | 'average' | 'moderately_fast' | 'very_fast',
      drivingSpeed: 'na' as 'na' | 'very_slow' | 'slow' | 'average' | 'moderately_fast' | 'very_fast',
      drivingSkill: 'na' as 'na' | 'poor' | 'average' | 'good' | 'excellent',
      robotDisability: 'none' as 'none' | 'small_part' | 'about_half' | 'nearly_whole',
      robotRange: 'na' as 'na' | 'short' | 'average' | 'long' | 'very_long',
      generalNotes: '' as string,
    },
    defense: 'na' as 'na' | 'bad' | 'average' | 'good',
  }));

  // Prefill when editing an existing record
  React.useEffect(() => {
    if (existing) {
      // map legacy fields where possible; fall back to defaults
      const legacyAutoFuel = (existing.auto?.l1 || 0) + (existing.auto?.l2 || 0) + (existing.auto?.l3 || 0) + (existing.auto?.l4 || 0) || existing.auto?.net || existing.auto?.fuel || 0;
      setFormData({
        auto: {
          fuel: existing.auto?.fuel ?? legacyAutoFuel ?? 0,
          neutralZone: !!existing.auto?.neutralZone,
          depot: !!existing.auto?.depot,
          outpost: !!existing.auto?.outpost,
          climbed: !!existing.auto?.climbed,
        },
        teleop: {
          transition: {
              fuel: existing.teleop?.transition?.fuel ?? existing.teleop?.transition?.notes ? 0 : 0,
            neutralZone: !!existing.teleop?.transition?.neutralZone,
            depot: !!existing.teleop?.transition?.depot,
            outpost: !!existing.teleop?.transition?.outpost,
          },
          firstOffence: {
            fuel: existing.teleop?.firstOffence?.fuel ?? 0,
            neutralZone: !!existing.teleop?.firstOffence?.neutralZone,
            depot: !!existing.teleop?.firstOffence?.depot,
            outpost: !!existing.teleop?.firstOffence?.outpost,
            launchedToSide: !!existing.teleop?.firstOffence?.launchedToSide,
          },
            endgame: {
              fuel: existing.teleop?.endgame?.fuel ?? 0,
              neutralZone: !!existing.teleop?.endgame?.neutralZone,
              depot: !!existing.teleop?.endgame?.depot,
              outpost: !!existing.teleop?.endgame?.outpost,
              launchedToSide: !!existing.teleop?.endgame?.launchedToSide,
            },
          firstDefense: {
            defense: existing.teleop?.firstDefense?.defense ?? existing.teleop?.firstDefense?.notes ? 'average' : 'na',
            neutralZone: !!existing.teleop?.firstDefense?.neutralZone,
            depot: !!existing.teleop?.firstDefense?.depot,
            outpost: !!existing.teleop?.firstDefense?.outpost,
            launchedToSide: !!existing.teleop?.firstDefense?.launchedToSide,
          },
          secondOffence: {
            fuel: existing.teleop?.secondOffence?.fuel ?? 0,
            neutralZone: !!existing.teleop?.secondOffence?.neutralZone,
            depot: !!existing.teleop?.secondOffence?.depot,
            outpost: !!existing.teleop?.secondOffence?.outpost,
            launchedToSide: !!existing.teleop?.secondOffence?.launchedToSide,
          },
          secondDefense: {
            defense: existing.teleop?.secondDefense?.defense ?? 'na',
            neutralZone: !!existing.teleop?.secondDefense?.neutralZone,
            depot: !!existing.teleop?.secondDefense?.depot,
            outpost: !!existing.teleop?.secondDefense?.outpost,
            launchedToSide: !!existing.teleop?.secondDefense?.launchedToSide,
          },
        },
        endgame: {
          trench: existing.endgame?.trench ?? 'na',
          climb: existing.endgame?.climb ?? 'none',
          shootingAccuracy: existing.endgame?.shootingAccuracy ?? 'na',
          shootingSpeed: existing.endgame?.shootingSpeed ?? 'na',
          intakeSpeed: existing.endgame?.intakeSpeed ?? 'na',
          drivingSpeed: existing.endgame?.drivingSpeed ?? 'na',
          drivingSkill: existing.endgame?.drivingSkill ?? 'na',
          robotDisability: existing.endgame?.robotDisability ?? 'none',
          robotRange: existing.endgame?.robotRange ?? 'na',
          generalNotes: existing.endgame?.generalNotes || '',
        },
        defense: existing.defense ?? 'na',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isOnline = DataService.isOnline();

  const getTeamKey = (): string => {
    const alliance = match.alliances[user.alliance];
    return alliance.team_keys[user.position - 1] || '';
  };

  const handleScoreChange = (period: 'auto' | 'teleop', level: string, increment: number) => {
    if (period === 'auto' && level === 'fuel') {
      setFormData(prev => ({ ...prev, auto: { ...prev.auto, fuel: Math.max(0, (prev.auto as any).fuel + increment) } }));
      return;
    }
    // support nested teleop numeric counters by path like 'teleop.transition.fuel'
    if (period === 'teleop') {
      // level expected as dotted path after 'teleop.' e.g. 'transition.fuel' or 'firstOffence.fuel'
      const parts = level.split('.');
      setFormData(prev => {
        const next: any = JSON.parse(JSON.stringify(prev));
        let cur = next.teleop as any;
        for (let i = 0; i < parts.length - 1; i++) {
          cur = cur[parts[i]] = cur[parts[i]] || {};
        }
        const key = parts[parts.length - 1];
        cur[key] = Math.max(0, (Number(cur[key]) || 0) + increment);
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

  // build payload; if editing existing, preserve its id
  const scoutingData: any = {
    ...(existing || {}),
    id: (existing ? existing.id : undefined),
    matchKey: match.key,
    teamKey: getTeamKey(),
    scouter: user.username,
    alliance: user.alliance,
    position: user.position,
    ...formData,
    timestamp: Date.now(),
  } as any;

    try {
      if (existing) {
        // update existing
        DataService.updateScoutingData(scoutingData);
      } else {
        DataService.saveScoutingData(scoutingData);
      }
      if (isOnline) {
        const start = Date.now();
        try {
          await DataService.syncData();
          // eslint-disable-next-line no-console
          console.debug('ScoutingForm: sync completed in', Date.now() - start, 'ms');
        } catch (e: any) {
          // surface error to user
          setSubmitError(String(e?.message || e));
          // eslint-disable-next-line no-console
          console.error('ScoutingForm: sync error', e);
        }
      }

      onSubmit();
    } catch (error) {
      console.error('Error saving scouting data:', error);
      setSubmitError(String((error as any)?.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const ScoreButton = ({ label, value, onChange, size = 'md' }: {
    label: string;
    value: number;
    onChange: (delta: number) => void;
    size?: 'sm' | 'md' | 'lg';
  }) => {
    const outerClass = size === 'lg' ? 'bg-gray-50 rounded-lg p-6 text-center' : 'bg-gray-50 rounded-lg p-3 text-center';
    const btnClass = 'w-12 h-12 flex items-center justify-center rounded-md font-semibold select-none';
    const increments = [1, 5, 10];

    return (
      <div className={outerClass}>
        <h4 className="text-sm font-medium text-gray-700 mb-2">{label}</h4>
        <div className="flex items-center justify-center gap-3">
          {/* negative buttons in a row (red) */}
          <div className="flex items-center gap-2">
            {increments.slice().reverse().map((inc) => (
              <button
                key={`dec-${inc}`}
                type="button"
                onClick={() => onChange(-inc)}
                className={`${btnClass} bg-red-600 text-black hover:bg-red-700`}
                aria-label={`Decrease by ${inc}`}
              >
                -{inc}
              </button>
            ))}
          </div>

          {/* center numeric display */}
          <div className="bg-white border rounded-md w-20 h-12 flex items-center justify-center">
            <span className="text-xl font-bold text-black">{value}</span>
          </div>

          {/* positive buttons in a row (green) */}
          <div className="flex items-center gap-2">
            {increments.map((inc) => (
              <button
                key={`inc-${inc}`}
                type="button"
                onClick={() => onChange(inc)}
                className={`${btnClass} bg-green-400 text-black hover:bg-green-500`}
                aria-label={`Increase by ${inc}`}
              >
                +{inc}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Matches
            </button>
            <div className="flex items-center gap-2 text-sm">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-orange-500" />
              )}
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{readableMatchLabel(match)}</h1>
            <div className="mt-2 text-lg">
              <span className={`font-semibold ${user.alliance === 'red' ? 'text-red-600' : 'text-blue-600'}`}>
                Team {getTeamKey().replace('frc', '')}
              </span>
              <span className="text-gray-500 mx-2">•</span>
              <span className="text-gray-600">{user.alliance.toUpperCase()} {user.position}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <div className="bg-red-100 border border-red-200 text-red-800 p-3 rounded">{submitError}</div>
          )}
          {/* Autonomous Period */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Autonomous Period</h2>
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Fuel Scored</h4>
              <div className="flex w-full items-center gap-0">
                <ScoreButton
                  label="Fuel Scored"
                  value={formData.auto.fuel}
                  onChange={(delta) => handleScoreChange('auto', 'fuel', delta)}
                  size="md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.auto.neutralZone}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto: { ...prev.auto, neutralZone: e.target.checked } }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Collected from Neutral Zone</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.auto.depot}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto: { ...prev.auto, depot: e.target.checked } }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Collected from Depot</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.auto.outpost}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto: { ...prev.auto, outpost: e.target.checked } }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Collected from Outpost</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.auto.climbed}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto: { ...prev.auto, climbed: e.target.checked } }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Climbed in Auto</span>
              </label>
            </div>
          </div>

          {/* Teleop Period */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Teleop Period</h2>
              <div className="space-y-4">
                {/* Transition Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Transition Shift</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.teleop.transition.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, transition: { ...prev.teleop.transition, neutralZone: e.target.checked } } }))} className="rounded border-gray-300" />
                      <span className="text-gray-700">Collected from Neutral Zone</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.teleop.transition.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, transition: { ...prev.teleop.transition, depot: e.target.checked } } }))} className="rounded border-gray-300" />
                      <span className="text-gray-700">Collected from Depot</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.teleop.transition.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, transition: { ...prev.teleop.transition, outpost: e.target.checked } } }))} className="rounded border-gray-300" />
                      <span className="text-gray-700">Collected from Outpost</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 w-48">
                    <ScoreButton label="Transition Fuel" value={formData.teleop.transition.fuel} onChange={(d) => handleScoreChange('teleop', 'transition.fuel', d)} />
                  </div>
                </div>

                {/* First Offence Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">First Offence Shift</h3>
                  <div className="flex items-center gap-2 w-48 mb-2">
                    <ScoreButton label="First Offence Fuel" value={formData.teleop.firstOffence.fuel} onChange={(d) => handleScoreChange('teleop', 'firstOffence.fuel', d)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstOffence.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, neutralZone: e.target.checked } } }))} className="rounded"/> <span>Neutral Zone</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstOffence.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, depot: e.target.checked } } }))} className="rounded"/> <span>Depot</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstOffence.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, outpost: e.target.checked } } }))} className="rounded"/> <span>Outpost</span></label>
                    <label className="flex items-center gap-2 col-span-1 sm:col-span-3"><input type="checkbox" checked={formData.teleop.firstOffence.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, launchedToSide: e.target.checked } } }))} className="rounded"/> <span>Launched fuel to our side</span></label>
                  </div>
                </div>

                {/* First Defense Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">First Defense Shift</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <label className="block text-sm">Defense</label>
                    <select value={formData.teleop.firstDefense.defense} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, defense: e.target.value as any } } }))} className="col-span-1 sm:col-span-2 border rounded p-2">
                      <option value="na">N/A</option>
                      <option value="bad">Bad</option>
                      <option value="average">Average</option>
                      <option value="good">Good</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstDefense.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, neutralZone: e.target.checked } } }))} className="rounded"/> <span>Neutral Zone</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstDefense.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, depot: e.target.checked } } }))} className="rounded"/> <span>Depot</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstDefense.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, outpost: e.target.checked } } }))} className="rounded"/> <span>Outpost</span></label>
                    <label className="flex items-center gap-2 col-span-1 sm:col-span-3"><input type="checkbox" checked={formData.teleop.firstDefense.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, launchedToSide: e.target.checked } } }))} className="rounded"/> <span>Launched fuel to our side</span></label>
                  </div>
                </div>

                {/* Second Offence Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Second Offence Shift</h3>
                  <div className="flex items-center gap-2 w-48 mb-2">
                    <ScoreButton label="Second Offence Fuel" value={formData.teleop.secondOffence.fuel} onChange={(d) => handleScoreChange('teleop', 'secondOffence.fuel', d)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondOffence.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, neutralZone: e.target.checked } } }))} className="rounded"/> <span>Neutral Zone</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondOffence.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, depot: e.target.checked } } }))} className="rounded"/> <span>Depot</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondOffence.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, outpost: e.target.checked } } }))} className="rounded"/> <span>Outpost</span></label>
                    <label className="flex items-center gap-2 col-span-1 sm:col-span-3"><input type="checkbox" checked={formData.teleop.secondOffence.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, launchedToSide: e.target.checked } } }))} className="rounded"/> <span>Launched fuel to our side</span></label>
                  </div>
                </div>

                {/* Endgame (as part of Teleop) */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Endgame</h3>
                  <div className="flex items-center gap-2 w-48 mb-2">
                    <ScoreButton label="Endgame Fuel" value={formData.teleop.endgame.fuel} onChange={(d) => handleScoreChange('teleop', 'endgame.fuel', d)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.endgame.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, endgame: { ...prev.teleop.endgame, neutralZone: e.target.checked } } }))} className="rounded"/> <span>Neutral Zone</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.endgame.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, endgame: { ...prev.teleop.endgame, depot: e.target.checked } } }))} className="rounded"/> <span>Depot</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.endgame.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, endgame: { ...prev.teleop.endgame, outpost: e.target.checked } } }))} className="rounded"/> <span>Outpost</span></label>
                    <label className="flex items-center gap-2 col-span-1 sm:col-span-3"><input type="checkbox" checked={formData.teleop.endgame.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, endgame: { ...prev.teleop.endgame, launchedToSide: e.target.checked } } }))} className="rounded"/> <span>Launched fuel to our side</span></label>
                  </div>
                </div>

                {/* Second Defense Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Second Defense Shift</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <label className="block text-sm">Defense</label>
                    <select value={formData.teleop.secondDefense.defense} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, defense: e.target.value as any } } }))} className="col-span-1 sm:col-span-2 border rounded p-2">
                      <option value="na">N/A</option>
                      <option value="bad">Bad</option>
                      <option value="average">Average</option>
                      <option value="good">Good</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondDefense.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, neutralZone: e.target.checked } } }))} className="rounded"/> <span>Neutral Zone</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondDefense.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, depot: e.target.checked } } }))} className="rounded"/> <span>Depot</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondDefense.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, outpost: e.target.checked } } }))} className="rounded"/> <span>Outpost</span></label>
                    <label className="flex items-center gap-2 col-span-1 sm:col-span-3"><input type="checkbox" checked={formData.teleop.secondDefense.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, launchedToSide: e.target.checked } } }))} className="rounded"/> <span>Launched fuel to our side</span></label>
                  </div>
                </div>
              </div>
            
          </div>

          {/* General Notes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">General Notes</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">General Notes</label>
              <textarea value={formData.endgame.generalNotes} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, generalNotes: e.target.value } }))} className="w-full border rounded p-2" rows={3} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Could robot go under the trench?</label>
                <select value={formData.endgame.trench} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, trench: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="na">N/A</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Climb Level</label>
                <select value={formData.endgame.climb} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, climb: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="none">None</option>
                  <option value="level1">Level 1</option>
                  <option value="level2">Level 2</option>
                  <option value="level3">Level 3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shooting Accuracy</label>
                <select value={formData.endgame.shootingAccuracy} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, shootingAccuracy: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very_inaccurate">Very Inaccurate</option>
                  <option value="inaccurate">Inaccurate</option>
                  <option value="moderately_accurate">Moderately Accurate</option>
                  <option value="accurate">Accurate</option>
                  <option value="very_accurate">Very Accurate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shooting Speed</label>
                <select value={formData.endgame.shootingSpeed} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, shootingSpeed: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very_slow">Very Slow</option>
                  <option value="slow">Slow</option>
                  <option value="average">Average</option>
                  <option value="moderately_fast">Moderately Fast</option>
                  <option value="very_fast">Very Fast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Intake Speed</label>
                <select value={formData.endgame.intakeSpeed} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, intakeSpeed: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very_slow">Very Slow</option>
                  <option value="slow">Slow</option>
                  <option value="average">Average</option>
                  <option value="moderately_fast">Moderately Fast</option>
                  <option value="very_fast">Very Fast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Driving Speed</label>
                <select value={formData.endgame.drivingSpeed} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, drivingSpeed: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very_slow">Very Slow</option>
                  <option value="slow">Slow</option>
                  <option value="average">Average</option>
                  <option value="moderately_fast">Moderately Fast</option>
                  <option value="very_fast">Very Fast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Driving Skill</label>
                <select value={formData.endgame.drivingSkill} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, drivingSkill: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="poor">Poor</option>
                  <option value="average">Average</option>
                  <option value="good">Good</option>
                  <option value="excellent">Excellent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Robot Disability</label>
                <select value={formData.endgame.robotDisability} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, robotDisability: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="none">None</option>
                  <option value="small_part">Small part of match</option>
                  <option value="about_half">About half of match</option>
                  <option value="nearly_whole">Nearly the whole match</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Robot Range</label>
                <select value={formData.endgame.robotRange} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, robotRange: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="short">Short</option>
                  <option value="average">Average</option>
                  <option value="long">Long</option>
                  <option value="very_long">Very Long</option>
                </select>
              </div>
            </div>
          </div>

          {/* Defense */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Defense</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'none', label: 'No Defense' },
                { value: 'bad', label: 'Bad Defense' },
                { value: 'ok', label: 'OK Defense' },
                { value: 'great', label: 'Great Defense' }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, defense: option.value as any }))}
                  className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                    formData.defense === option.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {isSubmitting ? 'Submitting...' : 'Submit Scout Data'}
          </button>
        </form>
      </div>
    </div>
  );
}