export type ItemType = 
| "subscription"
| "bill"
| "warranty";

export type  BillingInterval = 
| "once_weekly"
| "once_monthly"
| "twice_monthly"
| "once_quarterly"
| "once_yearly"
| "free_trial"
| "unknown";

export type CancellationDifficulty = 
| "easy"
| "moderate"
| "hard"
| "unknown";

export type Action = 
| "cancelled"
| "renewed"
| "disputed"

export type Health = 
| "thriving"
| "tired"
| "wilting"
| "critical"
| "dead"; //maybe even add a type where he randomly gets sick

export type Item = 
{

    //identity
    id : string;
    vendorName : string;
    itemType : ItemType;

    //Financial Information
    amount : number | null; //warranties wont have amounts 
    currency : string; 
    billingInterval : BillingInterval;

    //Specific Details
    expiryDate : string | null;
    isCancellable : boolean; //some subscriptions and the like cant be cancelled and therefore should be handled more aggresively in the app
    isRenew : boolean;
    isPriceHike : boolean;

    registrationDate : string;

    last_action : Action | null; //action
    last_action_at : string | null //date

    //Calculated values
    health_score : number;
    health_state : Health;

    //Each item should have its own corresponding creature type 
    creature: {
        name : string;
        species : "cloud" | "sprout" | "blob" | "ember" | "egg" | "gem";
    };
};

