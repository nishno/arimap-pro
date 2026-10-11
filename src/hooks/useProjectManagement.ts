import React, { useState, useEffect } from 'react';
import { Project, User, PlantationFeature, Layer, WorkAssignment, HarvestEvent, NutritionPlan, PlanExecution, InventoryItem, Employee, Account, Transaction, SystemLog, Machinery, DailyLogEntry, EmployeeGroup, ForumPost, Listing, Bid, Review, Alert, HarvestEntry, Pallet, HarvestLog, InventoryTransaction, AppMode } from '../types';
import { toast } from 'sonner';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from '../firebase';
import { handleFirestoreError, sanitizeObject } from '../lib/firebaseUtils';
import { USE_FIREBASE } from '../config';

export const useProjectManagement = (
    currentUser: User | null,
    plantationFeatures: PlantationFeature[],
    layers: Layer[],
    workAssignments: WorkAssignment[],
    harvestEvents: HarvestEvent[],
    nutritionPlans: NutritionPlan[],
    planExecutions: PlanExecution[],
    inventoryItems: InventoryItem[],
    employees: Employee[],
    accounts: Account[],
    transactions: Transaction[],
    systemLogs: SystemLog[],
    machinery: Machinery[],
    dailyLogs: DailyLogEntry[],
    employeeGroups: EmployeeGroup[],
    forumPosts: ForumPost[],
    listings: Listing[],
    bids: Bid[],
    reviews: Review[],
    alerts: Alert[],
    harvestEntries: HarvestEntry[],
    pallets: Pallet[],
    harvestLogs: HarvestLog[],
    inventoryTransactions: InventoryTransaction[],
    mapCenter: [number, number],
    mapZoom: number,
    activeOrgId: string | null,
    appMode: string,
    projects: Project[],
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
    setPlantationFeatures: (features: PlantationFeature[]) => void,
    setLayers: (layers: Layer[]) => void,
    setWorkAssignments: (tasks: WorkAssignment[]) => void,
    setHarvestEvents: (events: HarvestEvent[]) => void,
    setNutritionPlans: (plans: NutritionPlan[]) => void,
    setPlanExecutions: (executions: PlanExecution[]) => void,
    setInventoryItems: (items: InventoryItem[]) => void,
    setEmployees: (employees: Employee[]) => void,
    setAccounts: (accounts: Account[]) => void,
    setTransactions: (transactions: Transaction[]) => void,
    setSystemLogs: (logs: SystemLog[]) => void,
    setMachinery: (machinery: Machinery[]) => void,
    setDailyLogs: (logs: DailyLogEntry[]) => void,
    setEmployeeGroups: (groups: EmployeeGroup[]) => void,
    setForumPosts: (posts: ForumPost[]) => void,
    setListings: (listings: Listing[]) => void,
    setBids: (bids: Bid[]) => void,
    setReviews: (reviews: Review[]) => void,
    setAlerts: (alerts: Alert[]) => void,
    setHarvestEntries: (entries: HarvestEntry[]) => void,
    setPallets: (pallets: Pallet[]) => void,
    setHarvestLogs: (logs: HarvestLog[]) => void,
    setInventoryTransactions: (transactions: InventoryTransaction[]) => void,
    setMapCenter: (center: [number, number]) => void,
    setMapZoom: (zoom: number) => void,
    setActiveOrgId: (id: string | null) => void,
    setAppMode: (mode: any) => void
) => {
    // Load mock projects from localStorage on mount if in mock mode
    useEffect(() => {
        if (!USE_FIREBASE) {
            const saved = localStorage.getItem('agri-planter-mock-projects');
            if (saved) {
                try {
                    setProjects(JSON.parse(saved));
                } catch (e) {}
            }
        }
    }, []);

    const handleSaveProject = async (name: string) => {
        if (!currentUser) {
            toast.error("You must be logged in to save projects.");
            return;
        }

        const newProject: Project = {
            id: `project-${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
            data: {
                mapCenter,
                zoom: mapZoom,
                appMode: appMode as AppMode,
                dashboardLayout: [],
                plantationFeatures,
                workAssignments,
                employees,
                inventoryItems,
                harvestEvents,
                dailyLogs,
                listings,
                inventoryTransactions,
                machinery,
                harvestEntries,
                harvestLogs,
                nutritionPlans,
                planExecutions,
                layers,
                accounts,
                transactions,
                systemLogs,
                employeeGroups,
                forumPosts,
                bids,
                reviews,
                alerts,
                pallets,
                activeOrgId
            }
        };

        if (!USE_FIREBASE) {
            const updatedProjects = [...projects, newProject];
            setProjects(updatedProjects);
            localStorage.setItem('agri-planter-mock-projects', JSON.stringify(updatedProjects));
            toast.success(`Project "${name}" saved locally.`);
            return;
        }

        try {
            const sanitizedProject = sanitizeObject(newProject);
            await setDoc(doc(db, 'projects', newProject.id), {
                ...sanitizedProject,
                userId: currentUser.id,
                organizationId: activeOrgId || 'personal'
            });
            toast.success(`Project "${name}" saved to cloud.`);
        } catch (error) {
            handleFirestoreError(error, 'write', `projects/${newProject.id}`);
            toast.error("Failed to save project to cloud.");
        }
    };

    const handleLoadProject = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            const { data } = project;
            if (data.mapCenter) setMapCenter(data.mapCenter);
            if (data.zoom) setMapZoom(data.zoom);
            if (data.plantationFeatures) setPlantationFeatures(data.plantationFeatures);
            if (data.workAssignments) setWorkAssignments(data.workAssignments);
            if (data.harvestEvents) setHarvestEvents(data.harvestEvents);
            if (data.nutritionPlans) setNutritionPlans(data.nutritionPlans);
            if (data.planExecutions) setPlanExecutions(data.planExecutions);
            if (data.inventoryItems) setInventoryItems(data.inventoryItems);
            if (data.employees) setEmployees(data.employees);
            if (data.layers) setLayers(data.layers);
            if (data.accounts) setAccounts(data.accounts);
            if (data.transactions) setTransactions(data.transactions);
            if (data.systemLogs) setSystemLogs(data.systemLogs);
            if (data.employeeGroups) setEmployeeGroups(data.employeeGroups);
            if (data.forumPosts) setForumPosts(data.forumPosts);
            if (data.bids) setBids(data.bids);
            if (data.reviews) setReviews(data.reviews);
            if (data.alerts) setAlerts(data.alerts);
            if (data.pallets) setPallets(data.pallets);
            
            if (data.machinery) setMachinery(data.machinery);
            if (data.dailyLogs) setDailyLogs(data.dailyLogs);
            if (data.listings) setListings(data.listings);
            if (data.harvestEntries) setHarvestEntries(data.harvestEntries);
            if (data.harvestLogs) setHarvestLogs(data.harvestLogs);
            if (data.inventoryTransactions) setInventoryTransactions(data.inventoryTransactions);
            if (data.activeOrgId) setActiveOrgId(data.activeOrgId);
            if (data.appMode) setAppMode(data.appMode);
            toast.success(`Project "${project.name}" loaded.`);
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!USE_FIREBASE) {
            const updatedProjects = projects.filter(p => p.id !== projectId);
            setProjects(updatedProjects);
            localStorage.setItem('agri-planter-mock-projects', JSON.stringify(updatedProjects));
            toast.success("Project deleted locally.");
            return;
        }

        try {
            await deleteDoc(doc(db, 'projects', projectId));
            toast.success("Project deleted from cloud.");
        } catch (error) {
            handleFirestoreError(error, 'delete', `projects/${projectId}`);
            toast.error("Failed to delete project from cloud.");
        }
    };

    const handleExportProjects = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "agri_planter_projects.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImportProjects = (imported: Project[]) => {
        const updatedProjects = [...projects, ...imported];
        setProjects(updatedProjects);
        if (!USE_FIREBASE) {
            localStorage.setItem('agri-planter-mock-projects', JSON.stringify(updatedProjects));
        }
        toast.success("Projects imported successfully.");
    };

    const handleShareProject = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            const shareUrl = `${window.location.origin}?project=${project.id}`;
            navigator.clipboard.writeText(shareUrl);
            toast.success("Share link copied to clipboard!");
        }
    };

    const handleExportCurrentState = () => {
        const currentState = {
            mapCenter,
            zoom: mapZoom,
            appMode: appMode as AppMode,
            plantationFeatures,
            workAssignments,
            employees,
            inventoryItems,
            harvestEvents,
            dailyLogs,
            listings,
            inventoryTransactions,
            machinery,
            harvestEntries,
            harvestLogs,
            nutritionPlans,
            planExecutions,
            layers,
            accounts,
            transactions,
            systemLogs,
            employeeGroups,
            forumPosts,
            bids,
            reviews,
            alerts,
            pallets,
            activeOrgId,
            timestamp: new Date().toISOString()
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentState));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `agrimap_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Backup file created and downloading...");
    };

    const handleImportState = (data: any) => {
        try {
            if (data.mapCenter) setMapCenter(data.mapCenter);
            if (data.zoom) setMapZoom(data.zoom);
            if (data.plantationFeatures) setPlantationFeatures(data.plantationFeatures);
            if (data.workAssignments) setWorkAssignments(data.workAssignments);
            if (data.harvestEvents) setHarvestEvents(data.harvestEvents);
            if (data.nutritionPlans) setNutritionPlans(data.nutritionPlans);
            if (data.planExecutions) setPlanExecutions(data.planExecutions);
            if (data.inventoryItems) setInventoryItems(data.inventoryItems);
            if (data.employees) setEmployees(data.employees);
            if (data.layers) setLayers(data.layers);
            if (data.accounts) setAccounts(data.accounts);
            if (data.transactions) setTransactions(data.transactions);
            if (data.systemLogs) setSystemLogs(data.systemLogs);
            if (data.employeeGroups) setEmployeeGroups(data.employeeGroups);
            if (data.forumPosts) setForumPosts(data.forumPosts);
            if (data.bids) setBids(data.bids);
            if (data.reviews) setReviews(data.reviews);
            if (data.alerts) setAlerts(data.alerts);
            if (data.pallets) setPallets(data.pallets);
            if (data.machinery) setMachinery(data.machinery);
            if (data.dailyLogs) setDailyLogs(data.dailyLogs);
            if (data.listings) setListings(data.listings);
            if (data.harvestEntries) setHarvestEntries(data.harvestEntries);
            if (data.harvestLogs) setHarvestLogs(data.harvestLogs);
            if (data.inventoryTransactions) setInventoryTransactions(data.inventoryTransactions);
            if (data.activeOrgId) setActiveOrgId(data.activeOrgId);
            if (data.appMode) setAppMode(data.appMode);
            
            toast.success("Backup restored successfully!");
        } catch (e) {
            console.error("Import failed", e);
            toast.error("Failed to restore backup. Invalid file format.");
        }
    };

    return {
        projects,
        handleSaveProject,
        handleLoadProject,
        handleDeleteProject,
        handleExportProjects,
        handleImportProjects,
        handleShareProject,
        handleExportCurrentState,
        handleImportState
    };
};
