import type { SpeakerMapping } from "../../../shared/types";

interface SpeakerMapProps {
  readonly mappings: readonly SpeakerMapping[];
  readonly audioTrackNames: readonly string[];
  readonly videoTrackNames: readonly string[];
  readonly onChange: (mappings: SpeakerMapping[]) => void;
}

export const SpeakerMap = ({
  mappings, audioTrackNames, videoTrackNames, onChange,
}: SpeakerMapProps) => {
  const addMapping = () => {
    const nextAudio = mappings.length;
    const nextVideo = mappings.length;
    if (nextAudio < audioTrackNames.length && nextVideo < videoTrackNames.length) {
      onChange([
        ...mappings,
        {
          audioTrackIndex: nextAudio,
          videoTrackIndex: nextVideo,
          speakerName: `Speaker ${mappings.length + 1}`,
        },
      ]);
    }
  };

  const removeMapping = (index: number) => {
    onChange(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof SpeakerMapping, value: number | string) => {
    onChange(
      mappings.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      )
    );
  };

  return (
    <div className="speaker-map">
      <label className="section-label">Speaker Mapping</label>
      {mappings.map((mapping, i) => (
        <div key={i} className="mapping-row">
          <select
            value={mapping.audioTrackIndex}
            onChange={(e) => updateMapping(i, "audioTrackIndex", Number(e.target.value))}
          >
            {audioTrackNames.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>
          <span className="arrow">&rarr;</span>
          <select
            value={mapping.videoTrackIndex}
            onChange={(e) => updateMapping(i, "videoTrackIndex", Number(e.target.value))}
          >
            {videoTrackNames.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>
          <button className="btn-remove" onClick={() => removeMapping(i)}>
            &times;
          </button>
        </div>
      ))}
      <button className="btn-add" onClick={addMapping}>+ Add Speaker</button>
    </div>
  );
};
