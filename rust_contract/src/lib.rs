use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Serialize, Deserialize, Debug)]
pub struct RecentGasPoint {
    pub timestamp: String,
    pub gas_gwei: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OptimizeInput {
    pub tx: String,
    pub current_gas: f64,
    pub recent: Vec<RecentGasPoint>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OptimizeOutput {
    pub suggested_gas: f64,
    pub risk: bool,
    pub optimal_time_iso: String,
    pub reason: String,
}

// A simple Rust-side optimizer mirroring the Python mock logic. For Stylus, compile to WASM.
#[no_mangle]
pub extern "C" fn optimize(input_json: *const u8, input_len: usize) -> *mut u8 {
    // For demo purposes we won't implement a robust FFI here. This file is a source example.
    // In a real Stylus contract you'd expose typed functions and compile to WASM.
    let slice = unsafe { std::slice::from_raw_parts(input_json, input_len) };
    let s = std::str::from_utf8(slice).unwrap_or("");
    let parsed: Result<OptimizeInput, _> = serde_json::from_str(s);
    let out = match parsed {
        Ok(inp) => {
            // preserve chronological order from input (assumed chronological recent data)
            let vals_chrono: Vec<f64> = inp.recent.iter().map(|p| p.gas_gwei).collect();
            let mut vals_sorted = vals_chrono.clone();
            vals_sorted.sort_by(|a,b| a.partial_cmp(b).unwrap());
            if vals_chrono.is_empty() {
                let res = OptimizeOutput{
                    suggested_gas: inp.current_gas,
                    risk: false,
                    optimal_time_iso: chrono::Utc::now().to_rfc3339(),
                    reason: String::from("No recent data"),
                };
                serde_json::to_string(&res).unwrap()
            } else {
                // compute median & p90 from sorted values
                let median = if vals_sorted.len() % 2 == 1 { vals_sorted[vals_sorted.len()/2] } else { (vals_sorted[vals_sorted.len()/2 -1] + vals_sorted[vals_sorted.len()/2]) / 2.0 };
                let p90_idx = ((vals_sorted.len() as f64) * 0.9).ceil() as usize - 1;
                let p90 = vals_sorted[p90_idx.min(vals_sorted.len()-1)];
                let suggested = if inp.current_gas > median { (inp.current_gas * 0.9).max(median) } else { (median * 0.9).max(inp.current_gas) };
                let risk = inp.current_gas > p90;
                // trend check: compare chronological halves (match Python behavior)
                let mid = vals_chrono.len()/2;
                let first_avg: f64 = vals_chrono[..mid].iter().sum::<f64>()/(mid.max(1) as f64);
                let last_avg: f64 = vals_chrono[mid..].iter().sum::<f64>()/((vals_chrono.len()-mid).max(1) as f64);
                let optimal = if last_avg < first_avg { chrono::Utc::now() + chrono::Duration::minutes(3) } else { chrono::Utc::now() };
                let res = OptimizeOutput{
                    suggested_gas: (suggested*100.0).round()/100.0,
                    risk,
                    optimal_time_iso: optimal.to_rfc3339(),
                    reason: format!("median={}", median)
                };
                serde_json::to_string(&res).unwrap()
            }
        }
        Err(_) => json!({"error":"invalid input"}).to_string()
    };
    let mut v = out.into_bytes();
    // allocate memory to return pointer — illustrative only
    let ptr = v.as_mut_ptr();
    std::mem::forget(v);
    ptr as *mut u8
}
