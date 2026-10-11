
import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, Zap } from 'lucide-react';

export const AdvancedAnalytics = () => {
    return (
        <div className="p-6 bg-white rounded-xl border border-blue-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Advanced Analytics (BETA)</h3>
                    <p className="text-sm text-gray-500">New experimental multi-variable yield prediction engine.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                    <div className="flex items-center gap-2 mb-2 text-gray-700">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-sm font-medium">Projected Yield</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">+12.4%</div>
                    <div className="text-xs text-green-600 mt-1 font-medium">Confidence: 89%</div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                    <div className="flex items-center gap-2 mb-2 text-gray-700">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">Market Momentum</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">Bullish</div>
                    <div className="text-xs text-blue-600 mt-1 font-medium">Source: Global Agri Index</div>
                </motion.div>
            </div>

            <div className="mt-6 p-3 bg-amber-50 border border-amber-100 rounded-md">
                <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Note:</strong> This feature is running in safe isolation from the main analytics module. 
                    Changes here won't affect your production data.
                </p>
            </div>
        </div>
    );
};
