import React, { useMemo, useState, useEffect, useRef } from 'react';
import { DataService } from '../services/dataService';
import { ArrowLeft, Camera } from 'lucide-react';

type PitForm = {
  underTrench: boolean;
  climbLevel: 'cannot' | 'level1' | 'level2' | 'level3';
  climbPositions: { side: boolean; pillar: boolean; center: boolean };
  hasAuto: boolean;
  canClimbInAuto: boolean;
  autoTypes: { outpost_side: boolean; center: boolean; depot_side: boolean };
};

const emptyForm: PitForm = {
  underTrench: false,
  climbLevel: 'cannot',
  climbPositions: { side: false, pillar: false, center: false },
  hasAuto: false,
  canClimbInAuto: false,
  autoTypes: { outpost_side: false, center: false, depot_side: false },
};

export function PitScouting({ onBack }: { onBack: () => void }) {
  const matches = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt);
  const teams = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m: any) => {
      ['red', 'blue'].forEach((a) => {
        (m.alliances?.[a]?.team_keys || []).forEach((tk: string) => set.add(tk));
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [form, setForm] = useState<PitForm>(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedTeam) return;
    const saved = DataService.getPitData(selectedTeam);
    if (saved) {
      setForm({ ...emptyForm, ...saved });
    } else {
      setForm(emptyForm);
    }
    // load saved images for this team
    const imgs = DataService.getPitImages(selectedTeam);
    setImages(imgs || []);
  }, [selectedTeam]);

  const save = () => {
    if (!selectedTeam) return;
    DataService.savePitData(selectedTeam, form as any);
    // persist images separately
    try {
      DataService.savePitImages(selectedTeam, images);
    } catch (e) {}
    // simple feedback could be added
    setSelectedTeam(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pit Scouting</h1>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Back to Matches</button>
          </div>
        </div>

        {!selectedTeam ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {teams.map(t => (
              <button key={t} onClick={() => setSelectedTeam(t)} className="bg-white p-4 rounded shadow hover:shadow-md text-left">
                <div className="text-lg font-semibold">{t.replace(/^frc/, '')}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedTeam(null)} className="p-2 rounded bg-gray-100 hover:bg-gray-200">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-xl font-bold">Team {selectedTeam.replace(/^frc/, '')} — Pit Scouting</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setForm(emptyForm); }} className="px-3 py-2 rounded bg-yellow-100 hover:bg-yellow-200">Reset</button>
                <button onClick={save} className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700">Save</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded">
                <label className="block font-medium mb-2">Can the robot go under the trench?</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2"><input type="radio" name="underTrench" checked={form.underTrench === true} onChange={() => setForm(f => ({ ...f, underTrench: true }))} /> Yes</label>
                  <label className="flex items-center gap-2"><input type="radio" name="underTrench" checked={form.underTrench === false} onChange={() => setForm(f => ({ ...f, underTrench: false }))} /> No</label>
                </div>
              </div>

              <div className="p-4 border rounded">
                <label className="block font-medium mb-2">What level can the robot climb to?</label>
                <select value={form.climbLevel} onChange={(e) => setForm(f => ({ ...f, climbLevel: e.target.value as any }))} className="w-full border rounded p-2">
                  <option value="cannot">Cannot climb</option>
                  <option value="level1">Level 1</option>
                  <option value="level2">Level 2</option>
                  <option value="level3">Level 3</option>
                </select>
              </div>

              <div className="p-4 border rounded">
                <label className="block font-medium mb-2">Positions the robot can climb from (select all that apply)</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.climbPositions.side} onChange={(e) => setForm(f => ({ ...f, climbPositions: { ...f.climbPositions, side: e.target.checked } }))} /> Side</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.climbPositions.pillar} onChange={(e) => setForm(f => ({ ...f, climbPositions: { ...f.climbPositions, pillar: e.target.checked } }))} /> Pillar</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.climbPositions.center} onChange={(e) => setForm(f => ({ ...f, climbPositions: { ...f.climbPositions, center: e.target.checked } }))} /> Center</label>
                </div>
              </div>

              <div className="p-4 border rounded">
                <label className="block font-medium mb-2">Does the robot have an auto?</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2"><input type="radio" name="hasAuto" checked={form.hasAuto === true} onChange={() => setForm(f => ({ ...f, hasAuto: true }))} /> Yes</label>
                  <label className="flex items-center gap-2"><input type="radio" name="hasAuto" checked={form.hasAuto === false} onChange={() => setForm(f => ({ ...f, hasAuto: false }))} /> No</label>
                </div>
              </div>

              <div className="p-4 border rounded">
                <label className="block font-medium mb-2">Can the robot climb in auto?</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2"><input type="radio" name="canClimbInAuto" checked={form.canClimbInAuto === true} onChange={() => setForm(f => ({ ...f, canClimbInAuto: true }))} /> Yes</label>
                  <label className="flex items-center gap-2"><input type="radio" name="canClimbInAuto" checked={form.canClimbInAuto === false} onChange={() => setForm(f => ({ ...f, canClimbInAuto: false }))} /> No</label>
                </div>
              </div>

              <div className="p-4 border rounded md:col-span-2">
                <label className="block font-medium mb-2">Type of auto (select all that apply)</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoTypes.outpost_side} onChange={(e) => setForm(f => ({ ...f, autoTypes: { ...f.autoTypes, outpost_side: e.target.checked } }))} /> Outpost side</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoTypes.center} onChange={(e) => setForm(f => ({ ...f, autoTypes: { ...f.autoTypes, center: e.target.checked } }))} /> Center</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoTypes.depot_side} onChange={(e) => setForm(f => ({ ...f, autoTypes: { ...f.autoTypes, depot_side: e.target.checked } }))} /> Depot side</label>
                </div>
              </div>

              <div className="p-4 border rounded md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-medium">Robot Photos</label>
                  <div className="flex items-center gap-2">
                    <button title="Open camera" onClick={() => setShowCamera(true)} className="p-2 rounded bg-gray-100 hover:bg-gray-200">
                      <Camera className="w-5 h-5" />
                    </button>
                    <button title="Add from device" onClick={() => fileInputRef.current?.click()} className="p-2 rounded bg-gray-100 hover:bg-gray-200">Add</button>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => {
                      const files = e.target.files; if (!files) return; const out: string[] = [];
                      Array.from(files).forEach(f => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setImages(prev => {
                              const next = [...prev, reader.result as string];
                              return next;
                            });
                            // persist immediately
                            try { if (selectedTeam) DataService.savePitImages(selectedTeam, [...DataService.getPitImages(selectedTeam), reader.result as string]); } catch (e) {}
                          }
                        };
                        reader.readAsDataURL(f);
                      });
                      // clear input to allow re-selecting same file
                      e.currentTarget.value = '';
                    }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {images.map((src, idx) => (
                    <div key={idx} className="relative w-28 h-20 bg-gray-100 rounded overflow-hidden">
                      <img src={src} alt={`robot-${idx}`} className="object-cover w-full h-full" />
                      <button onClick={() => { setImages(prev => { const n = [...prev]; n.splice(idx, 1); if (selectedTeam) DataService.savePitImages(selectedTeam, n); return n; }); }} className="absolute top-1 right-1 bg-red-600 text-white rounded px-1 text-xs">Del</button>
                    </div>
                  ))}
                </div>
              </div>

              {showCamera && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-white rounded-lg p-4 max-w-lg w-full">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Camera</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => {
                          // stop stream
                          if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
                          setShowCamera(false);
                        }} className="px-2 py-1 rounded bg-gray-100">Close</button>
                      </div>
                    </div>
                    <div className="w-full">
                      <video ref={videoRef} className="w-full h-64 bg-black rounded" autoPlay playsInline />
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={async () => {
                        try {
                          if (!streamRef.current) {
                            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                            streamRef.current = s;
                            if (videoRef.current) videoRef.current.srcObject = s;
                            // wait a short moment for camera to warm
                            await new Promise(r => setTimeout(r, 200));
                          }
                          // capture frame
                          const v = videoRef.current;
                          if (!v) return;
                          const canvas = document.createElement('canvas');
                          canvas.width = v.videoWidth || 1280;
                          canvas.height = v.videoHeight || 720;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                          const data = canvas.toDataURL('image/jpeg', 0.8);
                          setImages(prev => {
                            const next = [...prev, data];
                            try { if (selectedTeam) DataService.savePitImages(selectedTeam, next); } catch (e) {}
                            return next;
                          });
                        } catch (e) {
                          // ignore
                        }
                      }} className="px-3 py-2 rounded bg-blue-600 text-white">Take Photo</button>
                      <button onClick={() => {
                        // stop stream but keep modal open
                        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
                      }} className="px-3 py-2 rounded bg-gray-200">Stop Camera</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
