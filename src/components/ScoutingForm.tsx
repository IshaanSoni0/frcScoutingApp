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
}

export function ScoutingForm({ match, user, onBack, onSubmit }: ScoutingFormProps) {
  const [formData, setFormData] = useState({
    auto: { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false },
    teleop: { l1: 0, l2: 0, l3: 0, l4: 0, net: false, prosser: false },
  endgame: { climb: 'none' as 'none' | 'low' | 'deep', driverSkill: 'medium' as 'low' | 'medium' | 'high', robotSpeed: 'medium' as 'slow' | 'medium' | 'fast', died: 'none' as 'none' | 'partway' | 'start' },
    defense: 'none' as 'none' | 'bad' | 'ok' | 'great',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isOnline = DataService.isOnline();

  const getTeamKey = (): string => {
    const alliance = match.alliances[user.alliance];
    return alliance.team_keys[user.position - 1] || '';
  };

  const handleScoreChange = (period: 'auto' | 'teleop', level: 'l1' | 'l2' | 'l3' | 'l4', increment: number) => {
    setFormData(prev => ({
      ...prev,
      [period]: {
        ...prev[period],
        [level]: Math.max(0, prev[period][level] + increment),
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

  const scoutingData: any = {
      // do not set `id` here — let DataService.assign a proper UUID so Supabase uuid columns are satisfied
      // id: `${match.key}_${getTeamKey()}_${Date.now()}`,
      matchKey: match.key,
      teamKey: getTeamKey(),
      scouter: user.username,
      alliance: user.alliance,
      position: user.position,
    ...formData,
      timestamp: Date.now(),
  } as any;

    try {
      DataService.saveScoutingData(scoutingData);
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

  const ScoreButton = ({ label, value, onIncrement, onDecrement }: {
    label: string;
    value: number;
    onIncrement: () => void;
    onDecrement: () => void;
  }) => (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <h4 className="text-sm font-medium text-gray-700 mb-2">{label}</h4>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-red-600 transition-colors"
        >
          −
        </button>
        <span className="text-2xl font-bold text-gray-900 min-w-[2ch]">{value}</span>
        <button
          type="button"
          onClick={onIncrement}
          className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-green-600 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );

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
                label="L1"
                value={formData.auto.l1}
                onIncrement={() => handleScoreChange('auto', 'l1', 1)}
                onDecrement={() => handleScoreChange('auto', 'l1', -1)}
              />
              <ScoreButton
                label="L2"
                value={formData.auto.l2}
                onIncrement={() => handleScoreChange('auto', 'l2', 1)}
                onDecrement={() => handleScoreChange('auto', 'l2', -1)}
              />
              <ScoreButton
                label="L3"
                value={formData.auto.l3}
                onIncrement={() => handleScoreChange('auto', 'l3', 1)}
                onDecrement={() => handleScoreChange('auto', 'l3', -1)}
              />
              <ScoreButton
                label="L4"
                value={formData.auto.l4}
                onIncrement={() => handleScoreChange('auto', 'l4', 1)}
                onDecrement={() => handleScoreChange('auto', 'l4', -1)}
              />
            </div>
            {/* Auto Net/Prosser removed - tracked only in Teleop */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.auto.hasAuto}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  auto: { ...prev.auto, hasAuto: e.target.checked }
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Robot moved in auto</span>
            </label>
          </div>

          {/* Teleop Period */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Teleop Period</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScoreButton
                label="L1"
                value={formData.teleop.l1}
                onIncrement={() => handleScoreChange('teleop', 'l1', 1)}
                onDecrement={() => handleScoreChange('teleop', 'l1', -1)}
              />
              <ScoreButton
                label="L2"
                value={formData.teleop.l2}
                onIncrement={() => handleScoreChange('teleop', 'l2', 1)}
                onDecrement={() => handleScoreChange('teleop', 'l2', -1)}
              />
              <ScoreButton
                label="L3"
                value={formData.teleop.l3}
                onIncrement={() => handleScoreChange('teleop', 'l3', 1)}
                onDecrement={() => handleScoreChange('teleop', 'l3', -1)}
              />
              <ScoreButton
                label="L4"
                value={formData.teleop.l4}
                onIncrement={() => handleScoreChange('teleop', 'l4', 1)}
                onDecrement={() => handleScoreChange('teleop', 'l4', -1)}
              />
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <ScoreButton
                label="Net"
                value={formData.teleop.net || 0}
                onIncrement={() => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, net: (prev.teleop.net || 0) + 1 } }))}
                onDecrement={() => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, net: Math.max(0, (prev.teleop.net || 0) - 1) } }))}
              />
              <ScoreButton
                label="Prosser"
                value={formData.teleop.prosser || 0}
                onIncrement={() => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, prosser: (prev.teleop.prosser || 0) + 1 } }))}
                onDecrement={() => setFormData(prev => ({ ...prev, teleop: { ...prev.teleop, prosser: Math.max(0, (prev.teleop.prosser || 0) - 1) } }))}
              />
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
                  { value: 'deep', label: 'Deep Climb' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      endgame: { ...prev.endgame, climb: option.value as 'none' | 'low' | 'deep' }
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