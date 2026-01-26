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
      firstDefense: { defenseRating: 'na', neutralZone: false, depot: false, outpost: false, launchedToSide: false },
      secondOffence: { fuel: 0, neutralZone: false, depot: false, outpost: false, launchedToSide: false },
      secondDefense: { defenseRating: 'na', neutralZone: false, depot: false, outpost: false, launchedToSide: false },
    },
    endgame: { climb: 'none' as 'none' | 'low' | 'high', driverSkill: 'medium' as 'low' | 'medium' | 'high', robotSpeed: 'medium' as 'slow' | 'medium' | 'fast', died: 'none' as 'none' | 'partway' | 'start' },
    defense: 'none' as 'none' | 'bad' | 'ok' | 'great',
  }));

  // Prefill when editing an existing record
  React.useEffect(() => {
    if (existing) {
      setFormData({
        auto: { fuel: existing.auto?.fuel || 0, neutralZone: !!existing.auto?.neutralZone, depot: !!existing.auto?.depot, outpost: !!existing.auto?.outpost, climbed: !!existing.auto?.climbed },
        teleop: {
          transition: { fuel: existing.teleop?.transition?.fuel || 0, neutralZone: !!existing.teleop?.transition?.neutralZone, depot: !!existing.teleop?.transition?.depot, outpost: !!existing.teleop?.transition?.outpost },
          firstOffence: { fuel: existing.teleop?.firstOffence?.fuel || 0, neutralZone: !!existing.teleop?.firstOffence?.neutralZone, depot: !!existing.teleop?.firstOffence?.depot, outpost: !!existing.teleop?.firstOffence?.outpost, launchedToSide: !!existing.teleop?.firstOffence?.launchedToSide },
          firstDefense: { defenseRating: existing.teleop?.firstDefense?.defenseRating || 'na', neutralZone: !!existing.teleop?.firstDefense?.neutralZone, depot: !!existing.teleop?.firstDefense?.depot, outpost: !!existing.teleop?.firstDefense?.outpost, launchedToSide: !!existing.teleop?.firstDefense?.launchedToSide },
          secondOffence: { fuel: existing.teleop?.secondOffence?.fuel || 0, neutralZone: !!existing.teleop?.secondOffence?.neutralZone, depot: !!existing.teleop?.secondOffence?.depot, outpost: !!existing.teleop?.secondOffence?.outpost, launchedToSide: !!existing.teleop?.secondOffence?.launchedToSide },
          secondDefense: { defenseRating: existing.teleop?.secondDefense?.defenseRating || 'na', neutralZone: !!existing.teleop?.secondDefense?.neutralZone, depot: !!existing.teleop?.secondDefense?.depot, outpost: !!existing.teleop?.secondDefense?.outpost, launchedToSide: !!existing.teleop?.secondDefense?.launchedToSide },
        },
        endgame: {
          trenchAbility: existing.endgame?.trenchAbility || 'na',
          climbLevel: existing.endgame?.climbLevel || 'none',
          shootingAccuracy: existing.endgame?.shootingAccuracy || 'na',
          shootingSpeed: existing.endgame?.shootingSpeed || 'na',
          intakeSpeed: existing.endgame?.intakeSpeed || 'na',
          drivingSpeed: existing.endgame?.drivingSpeed || 'na',
          drivingSkill: existing.endgame?.drivingSkill || 'na',
          robotDisability: existing.endgame?.robotDisability || 'none',
          robotRange: existing.endgame?.robotRange || 'na',
          notes: existing.endgame?.notes || '',
        },
        defense: existing.defense || 'none',
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
    // teleop: level format "shiftName.fuel" (e.g., "firstOffence.fuel")
    if (period === 'teleop' && level.endsWith('.fuel')) {
      const [shift] = level.split('.');
      setFormData(prev => ({
        ...prev,
        teleop: {
          ...prev.teleop,
          [shift]: { ...((prev.teleop as any)[shift] || {}), fuel: Math.max(0, (((prev.teleop as any)[shift]?.fuel) || 0) + increment) }
        }
      }));
      return;
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

  const ScoreButton = ({ label, value, onIncrement, onDecrement, size = 'md' }: {
    label: string;
    value: number;
    onIncrement: () => void;
    onDecrement: () => void;
    size?: 'sm' | 'md' | 'lg';
  }) => {
    const outerClass = size === 'lg' ? 'bg-gray-50 rounded-lg p-8 text-center' : 'bg-gray-50 rounded-lg p-4 text-center';
    const btnSize = size === 'lg' ? 'w-12 h-12 text-3xl' : 'w-8 h-8';
    const valueClass = size === 'lg' ? 'text-4xl font-bold text-gray-900 min-w-[3ch]' : 'text-2xl font-bold text-gray-900 min-w-[2ch]';

    return (
      <div className={outerClass}>
        <h4 className="text-sm font-medium text-gray-700 mb-2">{label}</h4>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDecrement}
            className={`${btnSize} bg-red-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-red-600 transition-colors`}
          >
            −
          </button>
          <span className={valueClass}>{value}</span>
          <button
            type="button"
            onClick={onIncrement}
            className={`${btnSize} bg-green-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-green-600 transition-colors`}
          >
            +
          </button>
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
                <button
                  type="button"
                  onClick={() => handleScoreChange('auto', 'fuel', -1)}
                  className="flex-1 bg-red-600 text-white py-6 rounded-l-lg text-2xl font-bold hover:bg-red-700"
                  aria-label="Decrease fuel"
                >
                  −
                </button>

                <div className="w-20 flex items-center justify-center text-2xl font-bold border-t border-b border-gray-200">
                  {formData.auto.fuel}
                </div>

                <button
                  type="button"
                  onClick={() => handleScoreChange('auto', 'fuel', 1)}
                  className="flex-1 bg-green-600 text-white py-6 rounded-r-lg text-2xl font-bold hover:bg-green-700"
                  aria-label="Increase fuel"
                >
                  +
                </button>
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
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 mb-1">Collected From</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.transition.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, transition: { ...prev.teleop.transition, neutralZone: e.target.checked } } }))} /> Neutral</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.transition.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, transition: { ...prev.teleop.transition, depot: e.target.checked } } }))} /> Depot</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.transition.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, transition: { ...prev.teleop.transition, outpost: e.target.checked } } }))} /> Outpost</label>
                      </div>
                    </div>
                    <div className="w-40">
                      <ScoreButton label="Fuel" value={formData.teleop.transition.fuel || 0} onIncrement={() => handleScoreChange('teleop', 'transition.fuel', 1)} onDecrement={() => handleScoreChange('teleop', 'transition.fuel', -1)} />
                    </div>
                  </div>
                </div>

                {/* First Offence Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">First Offence Shift</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 mb-1">Collected From</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstOffence.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, neutralZone: e.target.checked } } }))} /> Neutral</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstOffence.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, depot: e.target.checked } } }))} /> Depot</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstOffence.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, outpost: e.target.checked } } }))} /> Outpost</label>
                      </div>
                      <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.teleop.firstOffence.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { ...prev.teleop.firstOffence, launchedToSide: e.target.checked } } }))} /> Launched to their side</label>
                    </div>
                    <div className="w-40">
                      <ScoreButton label="Fuel" value={formData.teleop.firstOffence.fuel || 0} onIncrement={() => handleScoreChange('teleop', 'firstOffence.fuel', 1)} onDecrement={() => handleScoreChange('teleop', 'firstOffence.fuel', -1)} />
                    </div>
                  </div>
                </div>

                {/* First Defense Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">First Defense Shift</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 mb-1">Defense Rating</label>
                      <select value={formData.teleop.firstDefense.defenseRating} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, defenseRating: e.target.value as any } } }))} className="border rounded p-2">
                        <option value="na">N/A</option>
                        <option value="bad">Bad</option>
                        <option value="average">Average</option>
                        <option value="good">Good</option>
                      </select>

                      <div className="mt-2">
                        <label className="block text-sm text-gray-700 mb-1">Collected From</label>
                        <div className="flex gap-2">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstDefense.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, neutralZone: e.target.checked } } }))} /> Neutral</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstDefense.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, depot: e.target.checked } } }))} /> Depot</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.firstDefense.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, outpost: e.target.checked } } }))} /> Outpost</label>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.teleop.firstDefense.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { ...prev.teleop.firstDefense, launchedToSide: e.target.checked } } }))} /> Launched to their side</label>
                    </div>
                  </div>
                </div>

                {/* Second Offence Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Second Offence Shift</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 mb-1">Collected From</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondOffence.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, neutralZone: e.target.checked } } }))} /> Neutral</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondOffence.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, depot: e.target.checked } } }))} /> Depot</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondOffence.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, outpost: e.target.checked } } }))} /> Outpost</label>
                      </div>
                      <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.teleop.secondOffence.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { ...prev.teleop.secondOffence, launchedToSide: e.target.checked } } }))} /> Launched to their side</label>
                    </div>
                    <div className="w-40">
                      <ScoreButton label="Fuel" value={formData.teleop.secondOffence.fuel || 0} onIncrement={() => handleScoreChange('teleop', 'secondOffence.fuel', 1)} onDecrement={() => handleScoreChange('teleop', 'secondOffence.fuel', -1)} />
                    </div>
                  </div>
                </div>

                {/* Second Defense Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Second Defense Shift</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-700 mb-1">Defense Rating</label>
                      <select value={formData.teleop.secondDefense.defenseRating} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, defenseRating: e.target.value as any } } }))} className="border rounded p-2">
                        <option value="na">N/A</option>
                        <option value="bad">Bad</option>
                        <option value="average">Average</option>
                        <option value="good">Good</option>
                      </select>

                      <div className="mt-2">
                        <label className="block text-sm text-gray-700 mb-1">Collected From</label>
                        <div className="flex gap-2">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondDefense.neutralZone} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, neutralZone: e.target.checked } } }))} /> Neutral</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondDefense.depot} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, depot: e.target.checked } } }))} /> Depot</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.teleop.secondDefense.outpost} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, outpost: e.target.checked } } }))} /> Outpost</label>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.teleop.secondDefense.launchedToSide} onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { ...prev.teleop.secondDefense, launchedToSide: e.target.checked } } }))} /> Launched to their side</label>
                    </div>
                  </div>
                </div>
              </div>
            
          </div>

          {/* Endgame & General Notes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Endgame & General Notes</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Could robot go under the trench?</label>
                <select value={(formData.endgame as any).trenchAbility || 'na'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, trenchAbility: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="na">N/A</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Climb Level</label>
                <select value={(formData.endgame as any).climbLevel || 'none'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, climbLevel: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="none">None</option>
                  <option value="level1">Level 1</option>
                  <option value="level2">Level 2</option>
                  <option value="level3">Level 3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shooting Accuracy</label>
                <select value={(formData.endgame as any).shootingAccuracy || 'na'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, shootingAccuracy: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very inaccurate">Very Inaccurate</option>
                  <option value="inaccurate">Inaccurate</option>
                  <option value="moderately accurate">Moderately Accurate</option>
                  <option value="accurate">Accurate</option>
                  <option value="very accurate">Very Accurate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shooting Speed</label>
                <select value={(formData.endgame as any).shootingSpeed || 'na'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, shootingSpeed: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very slow">Very Slow</option>
                  <option value="slow">Slow</option>
                  <option value="average">Average</option>
                  <option value="moderately fast">Moderately Fast</option>
                  <option value="very fast">Very Fast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intake Speed</label>
                <select value={(formData.endgame as any).intakeSpeed || 'na'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, intakeSpeed: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very slow">Very Slow</option>
                  <option value="slow">Slow</option>
                  <option value="average">Average</option>
                  <option value="moderately fast">Moderately Fast</option>
                  <option value="very fast">Very Fast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driving Speed</label>
                <select value={(formData.endgame as any).drivingSpeed || 'na'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, drivingSpeed: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="very slow">Very Slow</option>
                  <option value="slow">Slow</option>
                  <option value="average">Average</option>
                  <option value="moderately fast">Moderately Fast</option>
                  <option value="very fast">Very Fast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driving Skill</label>
                <select value={(formData.endgame as any).drivingSkill || 'na'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, drivingSkill: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="poor">Poor</option>
                  <option value="average">Average</option>
                  <option value="good">Good</option>
                  <option value="excellent">Excellent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Robot Disability</label>
                <select value={(formData.endgame as any).robotDisability || 'none'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, robotDisability: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="none">None</option>
                  <option value="small part of match">Small part of match</option>
                  <option value="about half of match">About half of match</option>
                  <option value="nearly the whole match">Nearly the whole match</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Robot Range</label>
                <select value={(formData.endgame as any).robotRange || 'na'} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, robotRange: e.target.value as any } }))} className="w-full border rounded p-2">
                  <option value="na">N/A</option>
                  <option value="short">Short</option>
                  <option value="average">Average</option>
                  <option value="long">Long</option>
                  <option value="very long">Very Long</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">General Notes</label>
              <textarea value={(formData.endgame as any).notes || ''} onChange={(e) => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, notes: e.target.value } }))} className="w-full border rounded p-2 h-28" />
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