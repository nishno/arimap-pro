import { trackModification } from '../firebase';
import { toast } from 'sonner';

/**
 * SyncTransaction representing a step in the multi-module data transfer process.
 * Stores transaction history so we can resume from checkpoints if interrupted.
 */
export interface SyncTransaction {
    id: string;
    sourceModule: 'harvest' | 'inventory' | 'agronomy' | 'tasks' | 'accounting' | 'system';
    targetModule: 'harvest' | 'inventory' | 'agronomy' | 'tasks' | 'accounting' | 'system';
    action: string;
    payload: any;
    status: 'pending' | 'processing' | 'success' | 'error';
    errorMsg?: string;
    timestamp: string;
    checkpointStep: number; // For resuming from exactly where it failed
    totalSteps: number;
}

class MiddleSyncBroker {
    private transactions: SyncTransaction[] = [];

    constructor() {
        this.loadTransactions();
    }

    private loadTransactions() {
        try {
            const saved = localStorage.getItem('agrimap-middle-transactions');
            if (saved) {
                this.transactions = JSON.parse(saved);
            }
        } catch (e) {
            console.error('[SyncBroker] Failed to load transactions:', e);
            this.transactions = [];
        }
    }

    private saveTransactions() {
        try {
            localStorage.setItem('agrimap-middle-transactions', JSON.stringify(this.transactions));
            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('agrimap-broker-transactions-updated'));
        } catch (e) {
            console.error('[SyncBroker] Failed to save transactions:', e);
        }
    }

    /**
     * Get all logged transactions for auditing.
     */
    public getTransactions(): SyncTransaction[] {
        return [...this.transactions];
    }

    /**
     * Clear successful transactions to save space.
     */
    public purgeSuccessful() {
        this.transactions = this.transactions.filter(t => t.status !== 'success');
        this.saveTransactions();
    }

    /**
     * Registers a multi-step transaction to coordinate data exchange between modules.
     * Prevents system "stacking" and provides step-by-step transaction log.
     */
    public createTransaction(
        source: SyncTransaction['sourceModule'],
        target: SyncTransaction['targetModule'],
        action: string,
        payload: any,
        totalSteps: number = 2
    ): SyncTransaction {
        const newTx: SyncTransaction = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            sourceModule: source,
            targetModule: target,
            action,
            payload,
            status: 'pending',
            timestamp: new Date().toISOString(),
            checkpointStep: 0,
            totalSteps
        };

        this.transactions.push(newTx);
        this.saveTransactions();
        console.log(`[SyncBroker] Transaction created: ${newTx.action} (${source} -> ${target})`);
        return newTx;
    }

    /**
     * Updates a transaction's status and checkpoint.
     */
    public updateCheckpoint(txId: string, step: number, status: SyncTransaction['status'], errorMsg?: string) {
        const tx = this.transactions.find(t => t.id === txId);
        if (tx) {
            tx.checkpointStep = step;
            tx.status = status;
            if (errorMsg) tx.errorMsg = errorMsg;
            tx.timestamp = new Date().toISOString();
            this.saveTransactions();
            console.log(`[SyncBroker] Tx ${txId} updated: Step ${step}/${tx.totalSteps} [${status}] ${errorMsg ? '- ' + errorMsg : ''}`);
        }
    }

    /**
     * Handles routing of Harvest Session completion to Inventory Stock and Accounting.
     * Includes resume-from-checkpoint capability.
     */
    public async processHarvestToStockTransfer(
        txId: string,
        harvestEvent: any,
        onUpdateInventoryItems: (updatedItems: any[]) => void,
        inventoryItems: any[]
    ): Promise<boolean> {
        const tx = this.transactions.find(t => t.id === txId);
        if (!tx) return false;

        this.updateCheckpoint(txId, 0, 'processing');

        try {
            // STEP 1: Process stock increases for harvested crops
            if (tx.checkpointStep < 1) {
                console.log('[SyncBroker] Executing Step 1: Updating stock items with harvest yield...');
                
                const cropName = harvestEvent.name || 'Blueberries';
                // Find or prepare inventory items to receive stock
                const matchedItem = inventoryItems.find((item: any) => 
                    item.name?.toLowerCase().includes(cropName.toLowerCase()) || 
                    item.category?.toLowerCase() === 'produce'
                );

                if (matchedItem) {
                    const currentStock = parseFloat(matchedItem.currentStock) || 0;
                    const additionalStock = parseFloat(harvestEvent.totalNetWeightKg) || 0;
                    const newStock = currentStock + additionalStock;

                    const updatedItem = {
                        ...matchedItem,
                        currentStock: newStock,
                        lastUpdated: new Date().toISOString()
                    };

                    // Propagate to parent state and sync queue
                    onUpdateInventoryItems(inventoryItems.map(i => i.id === matchedItem.id ? updatedItem : i));
                    
                    // Track in offline queue
                    trackModification(`inventoryItems/${matchedItem.id}`, 'set', updatedItem);
                    console.log(`[SyncBroker] Step 1 complete. Updated inventory item ${matchedItem.id} stock from ${currentStock} to ${newStock}`);
                } else {
                    console.warn(`[SyncBroker] No matching stock item found for crop "${cropName}". Adding warning to transaction log.`);
                }
                
                this.updateCheckpoint(txId, 1, 'processing');
            }

            // STEP 2: Process accounting transactions for salaries or expenses
            if (tx.checkpointStep < 2) {
                console.log('[SyncBroker] Executing Step 2: Logging payroll cost & packaging charges to Accounting...');

                const totalPickerCost = parseFloat(harvestEvent.totalPickerCost) || 0;
                const totalPackagingCost = parseFloat(harvestEvent.totalPackagingCost) || 0;

                if (totalPickerCost > 0 || totalPackagingCost > 0) {
                    const transactionId = `trans-${Date.now()}-broker`;
                    const accountId = 'acc-operating'; // Default operating account

                    const accountingTx = {
                        id: transactionId,
                        accountId,
                        type: 'expense',
                        amount: totalPickerCost + totalPackagingCost,
                        description: `Broker-generated expense: Harvest Session [${harvestEvent.name}] payroll & packaging`,
                        category: 'Payroll/Labor',
                        date: new Date().toISOString(),
                        status: 'completed',
                        referenceId: harvestEvent.id
                    };

                    trackModification(`transactions/${transactionId}`, 'set', accountingTx);
                    console.log(`[SyncBroker] Step 2 complete. Logged expense transaction of ${accountingTx.amount}`);
                } else {
                    console.log('[SyncBroker] Step 2: No labor or packaging costs to log.');
                }

                this.updateCheckpoint(txId, 2, 'success');
            }

            toast.success(`Inter-module transfer completed successfully!`);
            return true;
        } catch (err: any) {
            const errorMsg = err?.message || 'Unknown data transfer error';
            this.updateCheckpoint(txId, tx.checkpointStep, 'error', errorMsg);
            toast.error(`Transfer stopped at step ${tx.checkpointStep}: ${errorMsg}. You can resume later.`);
            return false;
        }
    }

    /**
     * Resumes a failed or pending transaction from its last successful checkpoint.
     */
    public async resumeTransaction(
        txId: string,
        onUpdateInventoryItems: (updatedItems: any[]) => void,
        inventoryItems: any[]
    ): Promise<boolean> {
        const tx = this.transactions.find(t => t.id === txId);
        if (!tx) return false;

        console.log(`[SyncBroker] Resuming transaction ${txId} from step ${tx.checkpointStep}...`);
        
        if (tx.action === 'HarvestToStockTransfer') {
            return this.processHarvestToStockTransfer(txId, tx.payload, onUpdateInventoryItems, inventoryItems);
        }

        return false;
    }
}

export const syncBroker = new MiddleSyncBroker();
