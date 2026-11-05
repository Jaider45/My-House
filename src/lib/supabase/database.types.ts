
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "accounts": {
                  Row: {
                    "archivada": boolean,"created_at": string,"cupo": number | null,"dia_corte": number | null,"dia_pago": number | null,"entidad": string | null,"household_id": string,"id": string,"mapeo_csv": Json | null,"nombre": string,"saldo_inicial": number,"tipo": Database["public"]['Enums']["cuenta_tipo"],"titular_member_id": string | null,"ultimos4": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archivada"?: boolean,"created_at"?: string,"cupo"?: number | null,"dia_corte"?: number | null,"dia_pago"?: number | null,"entidad"?: string | null,"household_id": string,"id"?: string,"mapeo_csv"?: Json | null,"nombre": string,"saldo_inicial"?: number,"tipo": Database["public"]['Enums']["cuenta_tipo"],"titular_member_id"?: string | null,"ultimos4"?: string | null
                  }
                  Update: {
                    "archivada"?: boolean,"created_at"?: string,"cupo"?: number | null,"dia_corte"?: number | null,"dia_pago"?: number | null,"entidad"?: string | null,"household_id"?: string,"id"?: string,"mapeo_csv"?: Json | null,"nombre"?: string,"saldo_inicial"?: number,"tipo"?: Database["public"]['Enums']["cuenta_tipo"],"titular_member_id"?: string | null,"ultimos4"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_titular_member_id_household_id_fkey"
      columns: ["titular_member_id","household_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"assistant_messages": {
                  Row: {
                    "autor": string,"created_at": string,"created_by": string | null,"household_id": string,"id": string,"receipt_ids": (string)[],"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor": string,"created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"receipt_ids"?: (string)[],"texto"?: string
                  }
                  Update: {
                    "autor"?: string,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"receipt_ids"?: (string)[],"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistant_messages_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "archivo_path": string,"created_at": string,"household_id": string,"id": string,"tipo": Database["public"]['Enums']["adjunto_tipo"],"transaction_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archivo_path": string,"created_at"?: string,"household_id": string,"id"?: string,"tipo": Database["public"]['Enums']["adjunto_tipo"],"transaction_id": string
                  }
                  Update: {
                    "archivo_path"?: string,"created_at"?: string,"household_id"?: string,"id"?: string,"tipo"?: Database["public"]['Enums']["adjunto_tipo"],"transaction_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_transaction_id_household_id_fkey"
      columns: ["transaction_id","household_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"budgets_goals": {
                  Row: {
                    "ahorrado_inicial": number,"aporte_mensual": number | null,"category_id": string | null,"created_at": string,"es_emergencia": boolean,"fecha_objetivo": string | null,"household_id": string,"icono": string | null,"id": string,"monto": number,"nombre": string | null,"periodo": Database["public"]['Enums']["periodo"],"tipo": Database["public"]['Enums']["meta_tipo"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ahorrado_inicial"?: number,"aporte_mensual"?: number | null,"category_id"?: string | null,"created_at"?: string,"es_emergencia"?: boolean,"fecha_objetivo"?: string | null,"household_id": string,"icono"?: string | null,"id"?: string,"monto": number,"nombre"?: string | null,"periodo": Database["public"]['Enums']["periodo"],"tipo": Database["public"]['Enums']["meta_tipo"]
                  }
                  Update: {
                    "ahorrado_inicial"?: number,"aporte_mensual"?: number | null,"category_id"?: string | null,"created_at"?: string,"es_emergencia"?: boolean,"fecha_objetivo"?: string | null,"household_id"?: string,"icono"?: string | null,"id"?: string,"monto"?: number,"nombre"?: string | null,"periodo"?: Database["public"]['Enums']["periodo"],"tipo"?: Database["public"]['Enums']["meta_tipo"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_goals_category_id_household_id_fkey"
      columns: ["category_id","household_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "budgets_goals_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archivada": boolean,"clase": Database["public"]['Enums']["categoria_clase"],"created_at": string,"es_esencial": boolean,"excluir_de_costo_vida": boolean,"household_id": string,"id": string,"nombre": string,"padre_id": string | null,"tipo": Database["public"]['Enums']["categoria_tipo"]
                  }
                  ComputedFields: never
                  Insert: {
                    "archivada"?: boolean,"clase"?: Database["public"]['Enums']["categoria_clase"],"created_at"?: string,"es_esencial"?: boolean,"excluir_de_costo_vida"?: boolean,"household_id": string,"id"?: string,"nombre": string,"padre_id"?: string | null,"tipo"?: Database["public"]['Enums']["categoria_tipo"]
                  }
                  Update: {
                    "archivada"?: boolean,"clase"?: Database["public"]['Enums']["categoria_clase"],"created_at"?: string,"es_esencial"?: boolean,"excluir_de_costo_vida"?: boolean,"household_id"?: string,"id"?: string,"nombre"?: string,"padre_id"?: string | null,"tipo"?: Database["public"]['Enums']["categoria_tipo"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_padre_id_household_id_fkey"
      columns: ["padre_id","household_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"debts": {
                  Row: {
                    "archivada": boolean,"created_at": string,"cuota": number | null,"cuotas_total": number | null,"detalle": string | null,"dia_pago": number | null,"fecha_limite": string | null,"household_id": string,"id": string,"member_id": string | null,"monto": number,"nombre": string,"pagado_inicial": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archivada"?: boolean,"created_at"?: string,"cuota"?: number | null,"cuotas_total"?: number | null,"detalle"?: string | null,"dia_pago"?: number | null,"fecha_limite"?: string | null,"household_id": string,"id"?: string,"member_id"?: string | null,"monto": number,"nombre": string,"pagado_inicial"?: number
                  }
                  Update: {
                    "archivada"?: boolean,"created_at"?: string,"cuota"?: number | null,"cuotas_total"?: number | null,"detalle"?: string | null,"dia_pago"?: number | null,"fecha_limite"?: string | null,"household_id"?: string,"id"?: string,"member_id"?: string | null,"monto"?: number,"nombre"?: string,"pagado_inicial"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "debts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "debts_member_id_household_id_fkey"
      columns: ["member_id","household_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"households": {
                  Row: {
                    "ciudad": string | null,"config": NonNullable<Json>,"created_at": string,"id": string,"moneda": string,"nombre": string,"pais": string,"plan": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ciudad"?: string | null,"config"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"moneda"?: string,"nombre": string,"pais"?: string,"plan"?: string
                  }
                  Update: {
                    "ciudad"?: string | null,"config"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"moneda"?: string,"nombre"?: string,"pais"?: string,"plan"?: string
                  }
                  Relationships: [
                    
                  ]
                },"import_batches": {
                  Row: {
                    "account_id": string,"archivo_nombre": string,"created_at": string,"created_by": string | null,"filas_duplicadas": number,"filas_importadas": number,"filas_total": number,"household_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"archivo_nombre": string,"created_at"?: string,"created_by"?: string | null,"filas_duplicadas": number,"filas_importadas": number,"filas_total": number,"household_id": string,"id"?: string
                  }
                  Update: {
                    "account_id"?: string,"archivo_nombre"?: string,"created_at"?: string,"created_by"?: string | null,"filas_duplicadas"?: number,"filas_importadas"?: number,"filas_total"?: number,"household_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_account_id_household_id_fkey"
      columns: ["account_id","household_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","household_id"]
    },{
      foreignKeyName: "import_batches_account_id_household_id_fkey"
      columns: ["account_id","household_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "import_batches_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "aceptada_en": string | null,"creada_por": string | null,"created_at": string,"email": string,"expira_en": string,"household_id": string,"id": string,"rol": Database["public"]['Enums']["rol_miembro"],"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptada_en"?: string | null,"creada_por"?: string | null,"created_at"?: string,"email": string,"expira_en"?: string,"household_id": string,"id"?: string,"rol"?: Database["public"]['Enums']["rol_miembro"],"token"?: string
                  }
                  Update: {
                    "aceptada_en"?: string | null,"creada_por"?: string | null,"created_at"?: string,"email"?: string,"expira_en"?: string,"household_id"?: string,"id"?: string,"rol"?: Database["public"]['Enums']["rol_miembro"],"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"es_dependiente": boolean,"household_id": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_miembro"] | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"es_dependiente"?: boolean,"household_id": string,"id"?: string,"nombre": string,"rol"?: Database["public"]['Enums']["rol_miembro"] | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"es_dependiente"?: boolean,"household_id"?: string,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_miembro"] | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"merchant_rules": {
                  Row: {
                    "activa": boolean,"ambito": Database["public"]['Enums']["ambito"] | null,"category_id": string,"created_at": string,"household_id": string,"id": string,"patron": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"ambito"?: Database["public"]['Enums']["ambito"] | null,"category_id": string,"created_at"?: string,"household_id": string,"id"?: string,"patron": string
                  }
                  Update: {
                    "activa"?: boolean,"ambito"?: Database["public"]['Enums']["ambito"] | null,"category_id"?: string,"created_at"?: string,"household_id"?: string,"id"?: string,"patron"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "merchant_rules_category_id_household_id_fkey"
      columns: ["category_id","household_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "merchant_rules_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"receipts": {
                  Row: {
                    "archivo_path": string | null,"created_at": string,"created_by": string | null,"datos": NonNullable<Json>,"estado": Database["public"]['Enums']["comprobante_estado"],"household_id": string,"id": string,"mime": string | null,"nombre_archivo": string | null,"pregunta": string | null,"transaction_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archivo_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"datos"?: NonNullable<Json>,"estado"?: Database["public"]['Enums']["comprobante_estado"],"household_id": string,"id"?: string,"mime"?: string | null,"nombre_archivo"?: string | null,"pregunta"?: string | null,"transaction_id"?: string | null
                  }
                  Update: {
                    "archivo_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"datos"?: NonNullable<Json>,"estado"?: Database["public"]['Enums']["comprobante_estado"],"household_id"?: string,"id"?: string,"mime"?: string | null,"nombre_archivo"?: string | null,"pregunta"?: string | null,"transaction_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receipts_transaction_id_household_id_fkey"
      columns: ["transaction_id","household_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"recurring_rules": {
                  Row: {
                    "account_id": string,"activa": boolean,"category_id": string,"created_at": string,"descripcion": string,"fecha_inicio": string,"frecuencia": Database["public"]['Enums']["frecuencia"],"household_id": string,"id": string,"member_id": string | null,"monto": number,"ocurrencias": number,"proxima_fecha": string,"recordar": boolean,"tipo": Database["public"]['Enums']["mov_tipo"]
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"activa"?: boolean,"category_id": string,"created_at"?: string,"descripcion": string,"fecha_inicio": string,"frecuencia": Database["public"]['Enums']["frecuencia"],"household_id": string,"id"?: string,"member_id"?: string | null,"monto": number,"ocurrencias"?: number,"proxima_fecha": string,"recordar"?: boolean,"tipo"?: Database["public"]['Enums']["mov_tipo"]
                  }
                  Update: {
                    "account_id"?: string,"activa"?: boolean,"category_id"?: string,"created_at"?: string,"descripcion"?: string,"fecha_inicio"?: string,"frecuencia"?: Database["public"]['Enums']["frecuencia"],"household_id"?: string,"id"?: string,"member_id"?: string | null,"monto"?: number,"ocurrencias"?: number,"proxima_fecha"?: string,"recordar"?: boolean,"tipo"?: Database["public"]['Enums']["mov_tipo"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_rules_account_id_household_id_fkey"
      columns: ["account_id","household_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","household_id"]
    },{
      foreignKeyName: "recurring_rules_account_id_household_id_fkey"
      columns: ["account_id","household_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "recurring_rules_category_id_household_id_fkey"
      columns: ["category_id","household_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "recurring_rules_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_rules_member_id_household_id_fkey"
      columns: ["member_id","household_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "activo": boolean,"avisos": (number)[],"canales": (string)[],"created_at": string,"fecha": string,"household_id": string,"id": string,"monto": number | null,"nombre": string,"repetir": Database["public"]['Enums']["repeticion"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"avisos"?: (number)[],"canales"?: (string)[],"created_at"?: string,"fecha": string,"household_id": string,"id"?: string,"monto"?: number | null,"nombre": string,"repetir"?: Database["public"]['Enums']["repeticion"]
                  }
                  Update: {
                    "activo"?: boolean,"avisos"?: (number)[],"canales"?: (string)[],"created_at"?: string,"fecha"?: string,"household_id"?: string,"id"?: string,"monto"?: number | null,"nombre"?: string,"repetir"?: Database["public"]['Enums']["repeticion"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"tax_params": {
                  Row: {
                    "anio": number,"id": string,"pais": string,"topes": NonNullable<Json>,"uvt_valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anio": number,"id"?: string,"pais": string,"topes": NonNullable<Json>,"uvt_valor": number
                  }
                  Update: {
                    "anio"?: number,"id"?: string,"pais"?: string,"topes"?: NonNullable<Json>,"uvt_valor"?: number
                  }
                  Relationships: [
                    
                  ]
                },"tax_tags": {
                  Row: {
                    "codigo": string,"id": string,"nombre": string,"pais": string,"renglon_formulario": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"id"?: string,"nombre": string,"pais": string,"renglon_formulario"?: string | null
                  }
                  Update: {
                    "codigo"?: string,"id"?: string,"nombre"?: string,"pais"?: string,"renglon_formulario"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"ambito": Database["public"]['Enums']["ambito"],"category_id": string | null,"comercio": string | null,"created_at": string,"created_by": string | null,"cuenta_destino_id": string | null,"debt_id": string | null,"estado": Database["public"]['Enums']["mov_estado"],"fecha": string,"goal_id": string | null,"household_id": string,"id": string,"import_batch_id": string | null,"import_hash": string | null,"member_id": string | null,"monto": number,"nota": string | null,"origen": Database["public"]['Enums']["mov_origen"],"recurring_rule_id": string | null,"tax_tag_id": string | null,"tipo": Database["public"]['Enums']["mov_tipo"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"ambito"?: Database["public"]['Enums']["ambito"],"category_id"?: string | null,"comercio"?: string | null,"created_at"?: string,"created_by"?: string | null,"cuenta_destino_id"?: string | null,"debt_id"?: string | null,"estado"?: Database["public"]['Enums']["mov_estado"],"fecha": string,"goal_id"?: string | null,"household_id": string,"id"?: string,"import_batch_id"?: string | null,"import_hash"?: string | null,"member_id"?: string | null,"monto": number,"nota"?: string | null,"origen"?: Database["public"]['Enums']["mov_origen"],"recurring_rule_id"?: string | null,"tax_tag_id"?: string | null,"tipo": Database["public"]['Enums']["mov_tipo"],"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"ambito"?: Database["public"]['Enums']["ambito"],"category_id"?: string | null,"comercio"?: string | null,"created_at"?: string,"created_by"?: string | null,"cuenta_destino_id"?: string | null,"debt_id"?: string | null,"estado"?: Database["public"]['Enums']["mov_estado"],"fecha"?: string,"goal_id"?: string | null,"household_id"?: string,"id"?: string,"import_batch_id"?: string | null,"import_hash"?: string | null,"member_id"?: string | null,"monto"?: number,"nota"?: string | null,"origen"?: Database["public"]['Enums']["mov_origen"],"recurring_rule_id"?: string | null,"tax_tag_id"?: string | null,"tipo"?: Database["public"]['Enums']["mov_tipo"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_household_id_fkey"
      columns: ["account_id","household_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","household_id"]
    },{
      foreignKeyName: "transactions_account_id_household_id_fkey"
      columns: ["account_id","household_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_category_id_household_id_fkey"
      columns: ["category_id","household_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_cuenta_destino_id_household_id_fkey"
      columns: ["cuenta_destino_id","household_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","household_id"]
    },{
      foreignKeyName: "transactions_cuenta_destino_id_household_id_fkey"
      columns: ["cuenta_destino_id","household_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_debt_id_household_id_fkey"
      columns: ["debt_id","household_id"]
isOneToOne: false
      referencedRelation: "debts"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_goal_id_household_id_fkey"
      columns: ["goal_id","household_id"]
isOneToOne: false
      referencedRelation: "budgets_goals"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_import_batch_id_household_id_fkey"
      columns: ["import_batch_id","household_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_member_id_household_id_fkey"
      columns: ["member_id","household_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_recurring_rule_id_household_id_fkey"
      columns: ["recurring_rule_id","household_id"]
isOneToOne: false
      referencedRelation: "recurring_rules"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "transactions_tax_tag_id_fkey"
      columns: ["tax_tag_id"]
isOneToOne: false
      referencedRelation: "tax_tags"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "account_balances": {
                  Row: {
                    "account_id": string,"household_id": string,"saldo": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "accounts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "aceptar_invitacion":
{ Args: { "p_nombre": string,"p_token": string }; Returns: string
                           },
"acumulados_tributarios":
{ Args: { "p_anio": number,"p_household": string }; Returns: {
              "compras_consumos": number,"consignaciones": number,"consumos_tarjeta": number,"ingresos_brutos": number,"member_id": string,"nombre": string,"patrimonio_bruto": number
            }[]
                           },
"crear_hogar":
{ Args: { "p_nombre": string,"p_nombre_miembro": string }; Returns: string
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"generar_recurrentes_hogar":
{ Args: { "p_household": string }; Returns: number
                           },
"totales_por_categoria":
{ Args: { "p_desde": string,"p_hasta": string,"p_household": string }; Returns: {
              "cantidad": number,"category_id": string,"estado": Database["public"]['Enums']["mov_estado"],"mes": string,"tipo": Database["public"]['Enums']["mov_tipo"],"total": number
            }[]
                           },
"ver_invitacion":
{ Args: { "p_token": string }; Returns: {
              "email": string,"hogar": string,"rol": Database["public"]['Enums']["rol_miembro"],"vigente": boolean
            }[]
                           }
          }
          Enums: {
            "adjunto_tipo": "factura"|"certificado"|"extracto","ambito": "personal"|"negocio","categoria_clase": "gasto"|"ingreso","categoria_tipo": "fijo"|"variable","comprobante_estado": "procesando"|"registrado"|"soporte"|"por_revisar"|"descartado"|"error","cuenta_tipo": "banco"|"efectivo"|"tarjeta"|"billetera","frecuencia": "semanal"|"quincenal"|"mensual"|"bimestral"|"trimestral"|"semestral"|"anual","meta_tipo": "presupuesto"|"meta","mov_estado": "confirmado"|"programado","mov_origen": "manual"|"importacion"|"recurrente"|"ocr"|"whatsapp"|"banco","mov_tipo": "ingreso"|"gasto"|"transferencia","periodo": "mensual"|"anual"|"unico","repeticion": "una_vez"|"mensual"|"anual","rol_miembro": "admin"|"editor"|"contador"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "adjunto_tipo": ["factura", "certificado", "extracto"],"ambito": ["personal", "negocio"],"categoria_clase": ["gasto", "ingreso"],"categoria_tipo": ["fijo", "variable"],"comprobante_estado": ["procesando", "registrado", "soporte", "por_revisar", "descartado", "error"],"cuenta_tipo": ["banco", "efectivo", "tarjeta", "billetera"],"frecuencia": ["semanal", "quincenal", "mensual", "bimestral", "trimestral", "semestral", "anual"],"meta_tipo": ["presupuesto", "meta"],"mov_estado": ["confirmado", "programado"],"mov_origen": ["manual", "importacion", "recurrente", "ocr", "whatsapp", "banco"],"mov_tipo": ["ingreso", "gasto", "transferencia"],"periodo": ["mensual", "anual", "unico"],"repeticion": ["una_vez", "mensual", "anual"],"rol_miembro": ["admin", "editor", "contador"]
          }
        }
} as const
