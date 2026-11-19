import React, { useState } from 'react';
import DesignView from '../components/DesignView';
import { useLanguage } from '../contexts/LanguageContext';
// Drawing uses memory-only setters; explicit company registration uses the existing account workflow.
export function DraftPlanner({ mapProps, user, onRegister, onAddOrg, onSwitchOrg }: {
    mapProps: any;
    user: any;
    onRegister: () => void;
    onAddOrg: any;
    onSwitchOrg: any;
}) {
    const { language } = useLanguage(), ka = language === 'ka';
    const [features, setFeatures] = useState<any[]>([]), [layers, setLayers] = useState<any[]>([{id:'draft',name:'Draft',isVisible:true,isLocked:false}]), [tool, setTool] = useState<any>({tool:null}), [selected, setSelected] = useState<string[]>([]);
    const noop = () => { }, save = async () => { onRegister(); };
    const draw = (type: any, geometry: any, _position: any, metadata: any = {}) => { if (geometry)
        setFeatures(previous => [...previous, { ...metadata, id: crypto.randomUUID(), type, geometry, name: metadata.name || type, layerId: layers[0]?.id || 'draft', organizationId: 'draft' }]); };
    const update = (feature: any) => setFeatures(previous => previous.map(row => row.id === feature.id ? feature : row));
    return <div className="flex flex-col flex-1 min-h-0"><div className="p-3 bg-amber-50 border-b text-slate-800 flex flex-wrap gap-3 items-center"><p>{ka ? 'პლანტაციის მონახაზი — რეგისტრაციამდე ცვლილებები მხოლოდ ამ გვერდზე ინახება.' : 'Plantation draft — changes stay on this page until you register a company.'}</p><button className="underline font-semibold" onClick={save}>{ka ? 'კომპანიის რეგისტრაცია შესანახად' : 'Register company to save'}</button></div><DesignView draftOnly onLogActivity={async()=>{}} onAddOrg={onAddOrg} onSwitchOrg={onSwitchOrg} layers={layers} plantationFeatures={features} activeDrawingTool={tool} onSetActiveDrawingTool={setTool} onFeatureDrawn={draw} selectedFeatureIds={selected} onSelectFeature={(id: any) => setSelected(id ? [id] : [])} onUpdateFeature={update} onUpdateLayer={(layer: any) => setLayers(previous => previous.map(row => row.id === layer.id ? layer : row))} onDeleteItems={(ids: any) => setFeatures(previous => previous.filter(row => !ids.includes(row.id)))} mapProps={{ ...mapProps, plantationFeatures: features, layers, activeDrawingTool: tool, onFeatureDrawn: draw, onUpdateFeature: update, selectedFeatureIds: selected, onSelectFeature: (id: any) => setSelected(id ? [id] : []), onSetActiveDrawingTool: setTool, operationalLogs: [], harvestLogs: [], hideBottomControls: true, cameras: [], showCameras: false, onMapRightClick: undefined }} onSetFlyToBounds={mapProps.onSetFlyToBounds || noop} onGenerateTrenches={noop} onGenerateSeedlings={noop} onMoveFeature={noop} onReparentFeature={noop} crops={[]} onAddLayer={() => setLayers(previous => [...previous, { id: crypto.randomUUID(), name: 'Draft', isVisible: true }])} onGenerateIrrigation={noop} onSendCommand={noop} canUndo={false} canRedo={false} onUndo={noop} onRedo={noop} onImport={noop} templates={[]} onSetPlacingTemplate={noop} appMode="design" onClearMap={() => setFeatures([])} isGuest={true} onSendToBack={noop} onBringToFront={noop} onPublishDraftFeatures={save} currentUser={user} organizations={[]} onStartMapRegistration={save}/></div>;
}
