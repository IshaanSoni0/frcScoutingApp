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
      transition: { notes: '' },
      firstOffence: { notes: '' },
      firstDefense: { notes: '' },
      secondOffence: { notes: '' },
      secondDefense: { notes: '' },
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
          transition: { notes: existing.teleop?.transition?.notes || '' },
          firstOffence: { notes: existing.teleop?.firstOffence?.notes || '' },
          firstDefense: { notes: existing.teleop?.firstDefense?.notes || '' },
          secondOffence: { notes: existing.teleop?.secondOffence?.notes || '' },
          secondDefense: { notes: existing.teleop?.secondDefense?.notes || '' },
        },
        endgame: { climb: existing.endgame?.climb || 'none', driverSkill: existing.endgame?.driverSkill || 'medium', robotSpeed: existing.endgame?.robotSpeed || 'medium', died: existing.endgame?.died || 'none' },
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
    // no generic teleop numeric counters in new layout
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <ScoreButton
                label="Fuel"
                value={formData.auto.fuel}
                onIncrement={() => handleScoreChange('auto', 'fuel', 1)}
                onDecrement={() => handleScoreChange('auto', 'fuel', -1)}
                size="lg"
              />
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
                  <textarea
                    value={formData.teleop.transition.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, transition: { notes: e.target.value } } }))}
                    placeholder="Notes for transition shift"
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />
                </div>

                {/* First Offence Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">First Offence Shift</h3>
                  <textarea
                    value={formData.teleop.firstOffence.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstOffence: { notes: e.target.value } } }))}
                    placeholder="Notes for first offence shift"
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />
                </div>

                {/* First Defense Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">First Defense Shift</h3>
                  <textarea
                    value={formData.teleop.firstDefense.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, firstDefense: { notes: e.target.value } } }))}
                    placeholder="Notes for first defense shift"
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />
                </div>

                {/* Second Offence Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Second Offence Shift</h3>
                  <textarea
                    value={formData.teleop.secondOffence.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondOffence: { notes: e.target.value } } }))}
                    placeholder="Notes for second offence shift"
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />
                </div>

                {/* Second Defense Shift */}
                <div className="border rounded p-3">
                  <h3 className="font-medium text-gray-800 mb-2">Second Defense Shift</h3>
                  <textarea
                    value={formData.teleop.secondDefense.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, secondDefense: { notes: e.target.value } } }))}
                    placeholder="Notes for second defense shift"
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />
                </div>
              </div>
            
          </div>

          {/* Endgame */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Endgame</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Climb</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'none', label: 'No Climb' },
                  { value: 'low', label: 'Low Climb' },
                  { value: 'high', label: 'High Climb' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      endgame: { ...prev.endgame, climb: option.value as 'none' | 'low' | 'high' }
                    }))}
                    className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                      formData.endgame.climb === option.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Driver Skill</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, driverSkill: option.value as any } }))}
                      className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                        formData.endgame.driverSkill === option.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Robot Speed</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'slow', label: 'Slow' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'fast', label: 'Fast' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, robotSpeed: option.value as any } }))}
                      className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                        formData.endgame.robotSpeed === option.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Robot Died</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'none', label: "Didn't die" },
                    { value: 'partway', label: 'Died partway' },
                    { value: 'start', label: 'Died at start' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, endgame: { ...prev.endgame, died: option.value as any } }))}
                      className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                          formData.endgame.died === option.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
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