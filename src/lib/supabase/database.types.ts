
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
                },"auditoria": {
                  Row: {
                    "accion": string,"agente": string | null,"creada": string,"detalle": NonNullable<Json>,"id": number,"ip": string | null,"objeto_id": string | null,"objeto_nombre": string | null,"objeto_tipo": string | null,"quien": string | null,"quien_nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accion": string,"agente"?: string | null,"creada"?: string,"detalle"?: NonNullable<Json>,"id"?: never,"ip"?: string | null,"objeto_id"?: string | null,"objeto_nombre"?: string | null,"objeto_tipo"?: string | null,"quien"?: string | null,"quien_nombre": string
                  }
                  Update: {
                    "accion"?: string,"agente"?: string | null,"creada"?: string,"detalle"?: NonNullable<Json>,"id"?: never,"ip"?: string | null,"objeto_id"?: string | null,"objeto_nombre"?: string | null,"objeto_tipo"?: string | null,"quien"?: string | null,"quien_nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"avisos_enviados": {
                  Row: {
                    "clave": string,"created_at": string,"destinatarios": number,"household_id": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"created_at"?: string,"destinatarios"?: number,"household_id": string,"tipo": string
                  }
                  Update: {
                    "clave"?: string,"created_at"?: string,"destinatarios"?: number,"household_id"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avisos_enviados_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
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
                },"campanas": {
                  Row: {
                    "alcance": number,"asunto": string,"boton_texto": string | null,"boton_url": string | null,"creada_nombre": string,"creada_por": string | null,"created_at": string,"cuerpo": string,"enviada_en": string | null,"enviados": number,"estado": string,"id": string,"nombre": string,"programada_para": string | null,"segmento": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alcance"?: number,"asunto": string,"boton_texto"?: string | null,"boton_url"?: string | null,"creada_nombre"?: string,"creada_por"?: string | null,"created_at"?: string,"cuerpo": string,"enviada_en"?: string | null,"enviados"?: number,"estado"?: string,"id"?: string,"nombre": string,"programada_para"?: string | null,"segmento": string,"titulo": string
                  }
                  Update: {
                    "alcance"?: number,"asunto"?: string,"boton_texto"?: string | null,"boton_url"?: string | null,"creada_nombre"?: string,"creada_por"?: string | null,"created_at"?: string,"cuerpo"?: string,"enviada_en"?: string | null,"enviados"?: number,"estado"?: string,"id"?: string,"nombre"?: string,"programada_para"?: string | null,"segmento"?: string,"titulo"?: string
                  }
                  Relationships: [
                    
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
                },"cobros": {
                  Row: {
                    "creado": string,"cupon": string | null,"descuento": number,"error": string | null,"estado": string,"factura_estado": string,"factura_numero": string | null,"factura_url": string | null,"household_id": string,"id": string,"metodo": string | null,"metodo_detalle": string | null,"monto": number,"motivo": string,"pagado_en": string | null,"pasarela": string,"periodo": string,"periodo_vence": string | null,"plan": string,"precio": number,"reembolso_motivo": string | null,"referencia": string,"transaccion_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado"?: string,"cupon"?: string | null,"descuento"?: number,"error"?: string | null,"estado"?: string,"factura_estado"?: string,"factura_numero"?: string | null,"factura_url"?: string | null,"household_id": string,"id"?: string,"metodo"?: string | null,"metodo_detalle"?: string | null,"monto": number,"motivo": string,"pagado_en"?: string | null,"pasarela"?: string,"periodo": string,"periodo_vence"?: string | null,"plan": string,"precio": number,"reembolso_motivo"?: string | null,"referencia": string,"transaccion_id"?: string | null
                  }
                  Update: {
                    "creado"?: string,"cupon"?: string | null,"descuento"?: number,"error"?: string | null,"estado"?: string,"factura_estado"?: string,"factura_numero"?: string | null,"factura_url"?: string | null,"household_id"?: string,"id"?: string,"metodo"?: string | null,"metodo_detalle"?: string | null,"monto"?: number,"motivo"?: string,"pagado_en"?: string | null,"pasarela"?: string,"periodo"?: string,"periodo_vence"?: string | null,"plan"?: string,"precio"?: number,"reembolso_motivo"?: string | null,"referencia"?: string,"transaccion_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cobros_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobros_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["codigo"]
    }
                  ]
                },"comisiones": {
                  Row: {
                    "base": number,"created_at": string,"estado": string,"firma": string,"hogares": number,"id": string,"mes": string,"monto": number,"pagada_en": string | null,"pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base"?: number,"created_at"?: string,"estado"?: string,"firma": string,"hogares"?: number,"id"?: string,"mes": string,"monto"?: number,"pagada_en"?: string | null,"pct": number
                  }
                  Update: {
                    "base"?: number,"created_at"?: string,"estado"?: string,"firma"?: string,"hogares"?: number,"id"?: string,"mes"?: string,"monto"?: number,"pagada_en"?: string | null,"pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "comisiones_firma_fkey"
      columns: ["firma"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"correos_enviados": {
                  Row: {
                    "actualizado": string,"asunto": string,"creado": string,"estado": string,"etiqueta": string,"id": number,"para": string,"resend_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado"?: string,"asunto"?: string,"creado"?: string,"estado"?: string,"etiqueta"?: string,"id"?: never,"para"?: string,"resend_id"?: string | null
                  }
                  Update: {
                    "actualizado"?: string,"asunto"?: string,"creado"?: string,"estado"?: string,"etiqueta"?: string,"id"?: never,"para"?: string,"resend_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"cupones": {
                  Row: {
                    "activo": boolean,"codigo": string,"created_at": string,"descripcion": string,"desde": string,"hasta": string | null,"periodo": string | null,"periodos": number | null,"planes": (string)[],"tipo": string,"usos": number,"usos_max": number | null,"valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"codigo": string,"created_at"?: string,"descripcion"?: string,"desde"?: string,"hasta"?: string | null,"periodo"?: string | null,"periodos"?: number | null,"planes"?: (string)[],"tipo": string,"usos"?: number,"usos_max"?: number | null,"valor": number
                  }
                  Update: {
                    "activo"?: boolean,"codigo"?: string,"created_at"?: string,"descripcion"?: string,"desde"?: string,"hasta"?: string | null,"periodo"?: string | null,"periodos"?: number | null,"planes"?: (string)[],"tipo"?: string,"usos"?: number,"usos_max"?: number | null,"valor"?: number
                  }
                  Relationships: [
                    
                  ]
                },"cupones_usos": {
                  Row: {
                    "cobro_id": string | null,"creado": string,"cupon": string,"household_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cobro_id"?: string | null,"creado"?: string,"cupon": string,"household_id": string
                  }
                  Update: {
                    "cobro_id"?: string | null,"creado"?: string,"cupon"?: string,"household_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cupones_usos_cobro_id_fkey"
      columns: ["cobro_id"]
isOneToOne: false
      referencedRelation: "cobros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupones_usos_cupon_fkey"
      columns: ["cupon"]
isOneToOne: false
      referencedRelation: "cupones"
      referencedColumns: ["codigo"]
    },{
      foreignKeyName: "cupones_usos_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
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
                },"eventos": {
                  Row: {
                    "creado": string,"household_id": string,"id": number,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado"?: string,"household_id": string,"id"?: never,"tipo": string
                  }
                  Update: {
                    "creado"?: string,"household_id"?: string,"id"?: never,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"eventos_pasarela": {
                  Row: {
                    "estado": string | null,"id": string,"pasarela": string,"payload": NonNullable<Json>,"recibido": string,"referencia": string | null,"resultado": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "estado"?: string | null,"id": string,"pasarela"?: string,"payload": NonNullable<Json>,"recibido"?: string,"referencia"?: string | null,"resultado"?: string | null
                  }
                  Update: {
                    "estado"?: string | null,"id"?: string,"pasarela"?: string,"payload"?: NonNullable<Json>,"recibido"?: string,"referencia"?: string | null,"resultado"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"hogar_activo": {
                  Row: {
                    "household_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "household_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "household_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hogar_activo_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"hogar_notas": {
                  Row: {
                    "autor": string | null,"autor_nombre": string,"creada": string,"household_id": string,"id": number,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor"?: string | null,"autor_nombre": string,"creada"?: string,"household_id": string,"id"?: never,"texto": string
                  }
                  Update: {
                    "autor"?: string | null,"autor_nombre"?: string,"creada"?: string,"household_id"?: string,"id"?: never,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hogar_notas_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "canal": string | null,"ciudad": string | null,"config": NonNullable<Json>,"contador_verificado": boolean,"created_at": string,"estado": string,"id": string,"moneda": string,"nombre": string,"pais": string,"plan": string,"prueba_hasta": string | null,"prueba_usada": boolean,"ref_codigo": string | null,"referido_por": string | null,"suspendido_motivo": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "canal"?: string | null,"ciudad"?: string | null,"config"?: NonNullable<Json>,"contador_verificado"?: boolean,"created_at"?: string,"estado"?: string,"id"?: string,"moneda"?: string,"nombre": string,"pais"?: string,"plan"?: string,"prueba_hasta"?: string | null,"prueba_usada"?: boolean,"ref_codigo"?: string | null,"referido_por"?: string | null,"suspendido_motivo"?: string | null
                  }
                  Update: {
                    "canal"?: string | null,"ciudad"?: string | null,"config"?: NonNullable<Json>,"contador_verificado"?: boolean,"created_at"?: string,"estado"?: string,"id"?: string,"moneda"?: string,"nombre"?: string,"pais"?: string,"plan"?: string,"prueba_hasta"?: string | null,"prueba_usada"?: boolean,"ref_codigo"?: string | null,"referido_por"?: string | null,"suspendido_motivo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "households_plan_fk"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["codigo"]
    },{
      foreignKeyName: "households_referido_por_fkey"
      columns: ["referido_por"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"ia_usos": {
                  Row: {
                    "creado_en": string,"household_id": string,"id": number,"tipo": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"household_id": string,"id"?: never,"tipo": string,"user_id"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"household_id"?: string,"id"?: never,"tipo"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ia_usos_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
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
                },"integraciones": {
                  Row: {
                    "activa": boolean,"actualizada_en": string,"actualizada_por": string | null,"config": NonNullable<Json>,"proveedor": string,"secretos": NonNullable<Json>,"ultimo_evento": string | null,"verificacion": Json | null,"verificada_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"actualizada_en"?: string,"actualizada_por"?: string | null,"config"?: NonNullable<Json>,"proveedor": string,"secretos"?: NonNullable<Json>,"ultimo_evento"?: string | null,"verificacion"?: Json | null,"verificada_en"?: string | null
                  }
                  Update: {
                    "activa"?: boolean,"actualizada_en"?: string,"actualizada_por"?: string | null,"config"?: NonNullable<Json>,"proveedor"?: string,"secretos"?: NonNullable<Json>,"ultimo_evento"?: string | null,"verificacion"?: Json | null,"verificada_en"?: string | null
                  }
                  Relationships: [
                    
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
                    "a_cargo_de": string | null,"created_at": string,"dependiente_dian": boolean,"es_dependiente": boolean,"fecha_nacimiento": string | null,"household_id": string,"id": string,"nombre": string,"nota": string | null,"parentesco": string | null,"rol": Database["public"]['Enums']["rol_miembro"] | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "a_cargo_de"?: string | null,"created_at"?: string,"dependiente_dian"?: boolean,"es_dependiente"?: boolean,"fecha_nacimiento"?: string | null,"household_id": string,"id"?: string,"nombre": string,"nota"?: string | null,"parentesco"?: string | null,"rol"?: Database["public"]['Enums']["rol_miembro"] | null,"user_id"?: string | null
                  }
                  Update: {
                    "a_cargo_de"?: string | null,"created_at"?: string,"dependiente_dian"?: boolean,"es_dependiente"?: boolean,"fecha_nacimiento"?: string | null,"household_id"?: string,"id"?: string,"nombre"?: string,"nota"?: string | null,"parentesco"?: string | null,"rol"?: Database["public"]['Enums']["rol_miembro"] | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_a_cargo_de_household_id_fkey"
      columns: ["a_cargo_de","household_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","household_id"]
    },{
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
                },"planes": {
                  Row: {
                    "codigo": string,"descripcion": string,"limites": NonNullable<Json>,"nombre": string,"orden": number,"para": string,"precio_anual": number,"precio_mensual": number,"publicado": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"descripcion"?: string,"limites"?: NonNullable<Json>,"nombre": string,"orden"?: number,"para"?: string,"precio_anual": number,"precio_mensual": number,"publicado"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "codigo"?: string,"descripcion"?: string,"limites"?: NonNullable<Json>,"nombre"?: string,"orden"?: number,"para"?: string,"precio_anual"?: number,"precio_mensual"?: number,"publicado"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plataforma_config": {
                  Row: {
                    "clave": string,"updated_at": string,"valor": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"updated_at"?: string,"valor": NonNullable<Json>
                  }
                  Update: {
                    "clave"?: string,"updated_at"?: string,"valor"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"platform_staff": {
                  Row: {
                    "activo": boolean,"created_at": string,"invitado_por": string | null,"nombre": string,"rol": Database["public"]['Enums']["rol_staff"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"invitado_por"?: string | null,"nombre": string,"rol": Database["public"]['Enums']["rol_staff"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"invitado_por"?: string | null,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_staff"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
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
                },"staff_invitaciones": {
                  Row: {
                    "aceptada": string | null,"creada_por": string | null,"created_at": string,"email": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_staff"],"token_hash": string,"vence": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptada"?: string | null,"creada_por"?: string | null,"created_at"?: string,"email": string,"id"?: string,"nombre": string,"rol": Database["public"]['Enums']["rol_staff"],"token_hash": string,"vence"?: string
                  }
                  Update: {
                    "aceptada"?: string | null,"creada_por"?: string | null,"created_at"?: string,"email"?: string,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_staff"],"token_hash"?: string,"vence"?: string
                  }
                  Relationships: [
                    
                  ]
                },"suscripciones": {
                  Row: {
                    "cancelar_al_vencer": boolean,"created_at": string,"cupon": string | null,"cupon_periodos_restantes": number | null,"desde": string,"estado": string,"household_id": string,"monto_periodo": number,"periodo": string,"plan": string,"updated_at": string,"vence": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelar_al_vencer"?: boolean,"created_at"?: string,"cupon"?: string | null,"cupon_periodos_restantes"?: number | null,"desde": string,"estado"?: string,"household_id": string,"monto_periodo": number,"periodo": string,"plan": string,"updated_at"?: string,"vence": string
                  }
                  Update: {
                    "cancelar_al_vencer"?: boolean,"created_at"?: string,"cupon"?: string | null,"cupon_periodos_restantes"?: number | null,"desde"?: string,"estado"?: string,"household_id"?: string,"monto_periodo"?: number,"periodo"?: string,"plan"?: string,"updated_at"?: string,"vence"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suscripciones_household_id_fkey"
      columns: ["household_id"]
isOneToOne: true
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suscripciones_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["codigo"]
    }
                  ]
                },"tax_params": {
                  Row: {
                    "anio": number,"deducciones": NonNullable<Json>,"id": string,"pais": string,"topes": NonNullable<Json>,"uvt_valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anio": number,"deducciones"?: NonNullable<Json>,"id"?: string,"pais": string,"topes": NonNullable<Json>,"uvt_valor": number
                  }
                  Update: {
                    "anio"?: number,"deducciones"?: NonNullable<Json>,"id"?: string,"pais"?: string,"topes"?: NonNullable<Json>,"uvt_valor"?: number
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
                    "account_id": string,"ambito": Database["public"]['Enums']["ambito"],"category_id": string | null,"client_id": string | null,"comercio": string | null,"created_at": string,"created_by": string | null,"cuenta_destino_id": string | null,"debt_id": string | null,"estado": Database["public"]['Enums']["mov_estado"],"fecha": string,"goal_id": string | null,"household_id": string,"id": string,"import_batch_id": string | null,"import_hash": string | null,"member_id": string | null,"monto": number,"nota": string | null,"origen": Database["public"]['Enums']["mov_origen"],"recurring_rule_id": string | null,"tax_tag_id": string | null,"tipo": Database["public"]['Enums']["mov_tipo"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"ambito"?: Database["public"]['Enums']["ambito"],"category_id"?: string | null,"client_id"?: string | null,"comercio"?: string | null,"created_at"?: string,"created_by"?: string | null,"cuenta_destino_id"?: string | null,"debt_id"?: string | null,"estado"?: Database["public"]['Enums']["mov_estado"],"fecha": string,"goal_id"?: string | null,"household_id": string,"id"?: string,"import_batch_id"?: string | null,"import_hash"?: string | null,"member_id"?: string | null,"monto": number,"nota"?: string | null,"origen"?: Database["public"]['Enums']["mov_origen"],"recurring_rule_id"?: string | null,"tax_tag_id"?: string | null,"tipo": Database["public"]['Enums']["mov_tipo"],"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"ambito"?: Database["public"]['Enums']["ambito"],"category_id"?: string | null,"client_id"?: string | null,"comercio"?: string | null,"created_at"?: string,"created_by"?: string | null,"cuenta_destino_id"?: string | null,"debt_id"?: string | null,"estado"?: Database["public"]['Enums']["mov_estado"],"fecha"?: string,"goal_id"?: string | null,"household_id"?: string,"id"?: string,"import_batch_id"?: string | null,"import_hash"?: string | null,"member_id"?: string | null,"monto"?: number,"nota"?: string | null,"origen"?: Database["public"]['Enums']["mov_origen"],"recurring_rule_id"?: string | null,"tax_tag_id"?: string | null,"tipo"?: Database["public"]['Enums']["mov_tipo"],"updated_at"?: string
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
"campana_hogares":
{ Args: { "p_campana": string }; Returns: string[]
                           },
"cancelar_al_vencer":
{ Args: { "p_cancelar": boolean,"p_hogar": string }; Returns: undefined
                           },
"cobro_pendiente":
{ Args: { "p_hogar": string }; Returns: Json
                           },
"consola_aceptar_invitacion":
{ Args: { "p_token": string }; Returns: Database["public"]['Enums']["rol_staff"]
                           },
"consola_activar":
{ Args: { "p_activo": boolean,"p_user": string }; Returns: undefined
                           },
"consola_analitica":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consola_auditoria":
{ Args: { "p_antes"?: number,"p_limite"?: number }; Returns: {
              "accion": string,"creada": string,"detalle": Json,"id": number,"ip": string,"objeto_nombre": string,"objeto_tipo": string,"quien_nombre": string
            }[]
                           },
"consola_cambiar_plan":
{ Args: { "p_id": string,"p_motivo": string,"p_plan": string }; Returns: undefined
                           },
"consola_cambiar_rol":
{ Args: { "p_rol": Database["public"]['Enums']["rol_staff"],"p_user": string }; Returns: undefined
                           },
"consola_campanas":
{ Args: Record<PropertyKey, never>; Returns: {
              "alcance": number,
"asunto": string,
"boton_texto": string | null,
"boton_url": string | null,
"creada_nombre": string,
"creada_por": string | null,
"created_at": string,
"cuerpo": string,
"enviada_en": string | null,
"enviados": number,
"estado": string,
"id": string,
"nombre": string,
"programada_para": string | null,
"segmento": string,
"titulo": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "campanas"
        isOneToOne: false
        isSetofReturn: true
      } },
"consola_cancelar_campana":
{ Args: { "p_id": string }; Returns: undefined
                           },
"consola_cancelar_invitacion":
{ Args: { "p_id": string }; Returns: undefined
                           },
"consola_cerrar_sesiones":
{ Args: { "p_user": string }; Returns: number
                           },
"consola_cobros":
{ Args: { "p_antes"?: string,"p_estado"?: string,"p_limite"?: number }; Returns: {
              "creado": string,"cupon": string,"descuento": number,"error": string,"estado": string,"factura_estado": string,"hogar": string,"household_id": string,"id": string,"metodo": string,"metodo_detalle": string,"monto": number,"motivo": string,"pagado_en": string,"pasarela": string,"periodo": string,"plan": string,"referencia": string
            }[]
                           },
"consola_cobros_resumen":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consola_contadores":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consola_correos_resumen":
{ Args: Record<PropertyKey, never>; Returns: {
              "abiertos": number,"clics": number,"entregados": number,"enviados": number,"etiqueta": string,"rebotados": number,"ultimo": string
            }[]
                           },
"consola_cupones":
{ Args: Record<PropertyKey, never>; Returns: {
              "activo": boolean,
"codigo": string,
"created_at": string,
"descripcion": string,
"desde": string,
"hasta": string | null,
"periodo": string | null,
"periodos": number | null,
"planes": (string)[],
"tipo": string,
"usos": number,
"usos_max": number | null,
"valor": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "cupones"
        isOneToOne: false
        isSetofReturn: true
      } },
"consola_desconectar_integracion":
{ Args: { "p_proveedor": string }; Returns: undefined
                           },
"consola_equipo":
{ Args: Record<PropertyKey, never>; Returns: {
              "activo": boolean,"created_at": string,"dos_pasos": string,"email": string,"nombre": string,"rol": Database["public"]['Enums']["rol_staff"],"ultimo_ingreso": string,"user_id": string
            }[]
                           },
"consola_exportar_auditoria":
{ Args: { "p_desde": string,"p_hasta": string }; Returns: {
              "accion": string,
"agente": string | null,
"creada": string,
"detalle": NonNullable<Json>,
"id": number,
"ip": string | null,
"objeto_id": string | null,
"objeto_nombre": string | null,
"objeto_tipo": string | null,
"quien": string | null,
"quien_nombre": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "auditoria"
        isOneToOne: false
        isSetofReturn: true
      } },
"consola_guardar_campana":
{ Args: { "p_asunto": string,"p_boton_texto": string,"p_boton_url": string,"p_cuerpo": string,"p_id": string,"p_nombre": string,"p_programada": string,"p_segmento": string,"p_titulo": string }; Returns: string
                           },
"consola_guardar_config":
{ Args: { "p_clave": string,"p_valor": Json }; Returns: undefined
                           },
"consola_guardar_cupon":
{ Args: { "p_activo": boolean,"p_codigo": string,"p_descripcion": string,"p_desde": string,"p_hasta": string,"p_periodo": string,"p_periodos": number,"p_planes": (string)[],"p_tipo": string,"p_usos_max": number,"p_valor": number }; Returns: undefined
                           },
"consola_guardar_integracion":
{ Args: { "p_activa": boolean,"p_config": Json,"p_proveedor": string,"p_secretos": Json }; Returns: undefined
                           },
"consola_guardar_plan":
{ Args: { "p_anual": number,"p_codigo": string,"p_limites": Json,"p_mensual": number,"p_nombre": string,"p_publicado": boolean }; Returns: undefined
                           },
"consola_hogar":
{ Args: { "p_id": string }; Returns: Json
                           },
"consola_hogar_cobros":
{ Args: { "p_id": string }; Returns: Json
                           },
"consola_hogares":
{ Args: { "p_antes"?: string,"p_buscar"?: string,"p_filtro"?: string,"p_limite"?: number }; Returns: {
              "admin_nombre": string,"created_at": string,"en_prueba": boolean,"estado": string,"id": string,"miembros": number,"movimientos_30d": number,"mrr": number,"nombre": string,"plan": string,"plan_efectivo": string,"ultimo_uso": string
            }[]
                           },
"consola_hogares_conteos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consola_integraciones":
{ Args: Record<PropertyKey, never>; Returns: {
              "activa": boolean,"actualizada_en": string,"actualizada_por": string,"config": Json,"proveedor": string,"secretos": Json,"ultimo_evento": string,"verificacion": Json,"verificada_en": string
            }[]
                           },
"consola_invitaciones":
{ Args: Record<PropertyKey, never>; Returns: {
              "creada_por": string,"created_at": string,"email": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_staff"],"vence": string
            }[]
                           },
"consola_invitar":
{ Args: { "p_email": string,"p_nombre": string,"p_rol": Database["public"]['Enums']["rol_staff"] }; Returns: string
                           },
"consola_liquidar_comisiones":
{ Args: { "p_mes": string }; Returns: Json
                           },
"consola_marcar_comision":
{ Args: { "p_id": string,"p_pagada": boolean }; Returns: undefined
                           },
"consola_marcar_reembolso":
{ Args: { "p_bajar_plan": boolean,"p_cobro": string,"p_motivo": string }; Returns: undefined
                           },
"consola_matriz_permisos":
{ Args: Record<PropertyKey, never>; Returns: {
              "permisos": (Database["public"]['Enums']["permiso_staff"])[],"rol": Database["public"]['Enums']["rol_staff"]
            }[]
                           },
"consola_metricas":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consola_nota_hogar":
{ Args: { "p_id": string,"p_texto": string }; Returns: undefined
                           },
"consola_planes":
{ Args: Record<PropertyKey, never>; Returns: {
              "codigo": string,
"descripcion": string,
"limites": NonNullable<Json>,
"nombre": string,
"orden": number,
"para": string,
"precio_anual": number,
"precio_mensual": number,
"publicado": boolean,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "planes"
        isOneToOne: false
        isSetofReturn: true
      } },
"consola_registrar_ingreso":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"consola_registrar_verificacion":
{ Args: { "p_detalle": string,"p_ok": boolean,"p_proveedor": string }; Returns: undefined
                           },
"consola_restablecer_2fa":
{ Args: { "p_user": string }; Returns: undefined
                           },
"consola_segmentos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consola_suspender":
{ Args: { "p_id": string,"p_motivo": string,"p_suspender": boolean }; Returns: undefined
                           },
"consola_usuarios":
{ Args: { "p_antes"?: string,"p_buscar"?: string,"p_filtro"?: string,"p_limite"?: number }; Returns: {
              "created_at": string,"dos_pasos": boolean,"email": string,"es_equipo": boolean,"hogar": string,"hogar_id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_miembro"],"ultimo_ingreso": string,"user_id": string
            }[]
                           },
"consola_usuarios_conteos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"consola_ver_correo":
{ Args: { "p_user": string }; Returns: string
                           },
"consola_ver_invitacion":
{ Args: { "p_token": string }; Returns: {
              "email": string,"nombre": string,"rol": Database["public"]['Enums']["rol_staff"],"vencida": boolean
            }[]
                           },
"consola_verificar_contador":
{ Args: { "p_id": string,"p_verificada": boolean }; Returns: undefined
                           },
"correos_de_usuarios":
{ Args: { "p_ids": (string)[] }; Returns: {
              "email": string,"id": string
            }[]
                           },
"cotizar_plan":
{ Args: { "p_cupon"?: string,"p_hogar": string,"p_periodo": string,"p_plan": string }; Returns: Json
                           },
"crear_cobro":
{ Args: { "p_cupon"?: string,"p_hogar": string,"p_periodo": string,"p_plan": string }; Returns: Json
                           },
"crear_hogar":
{ Args: { "p_canal"?: string,"p_nombre": string,"p_nombre_miembro": string,"p_ref"?: string }; Returns: string
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"elegir_hogar":
{ Args: { "p_hogar": string }; Returns: undefined
                           },
"generar_recurrentes_hogar":
{ Args: { "p_household": string }; Returns: number
                           },
"guardar_presupuesto":
{ Args: { "p_hogar": string,"p_items": Json }; Returns: undefined
                           },
"iniciar_prueba":
{ Args: { "p_hogar": string }; Returns: string
                           },
"integracion_evento":
{ Args: { "p_proveedor": string }; Returns: undefined
                           },
"integracion_leer":
{ Args: { "p_proveedor": string }; Returns: Json
                           },
"mi_firma":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mi_plan":
{ Args: { "p_hogar": string }; Returns: Json
                           },
"mis_clientes":
{ Args: Record<PropertyKey, never>; Returns: {
              "admin_nombre": string,"created_at": string,"id": string,"miembros": number,"movimientos_30d": number,"nombre": string,"pais": string,"ultimo_movimiento": string
            }[]
                           },
"mis_hogares_lista":
{ Args: Record<PropertyKey, never>; Returns: {
              "activo": boolean,"id": string,"nombre": string,"plan": string,"rol": Database["public"]['Enums']["rol_miembro"]
            }[]
                           },
"obtener_ref":
{ Args: { "p_hogar": string }; Returns: string
                           },
"procesar_vencimientos":
{ Args: { "p_hoy": string }; Returns: Json
                           },
"registrar_pago_wompi":
{ Args: { "p_detalle": string,"p_estado": string,"p_evento": string,"p_metodo": string,"p_monto_centavos": number,"p_payload": Json,"p_referencia": string,"p_transaccion": string }; Returns: Json
                           },
"reservar_uso_ia":
{ Args: { "p_cantidad"?: number,"p_hogar": string,"p_tipo": string }; Returns: undefined
                           },
"revision_seguridad":
{ Args: Record<PropertyKey, never>; Returns: {
              "objeto": string,"tipo": string
            }[]
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
                           },
"verificar_contrasena_actual":
{ Args: { "clave": string }; Returns: boolean
                           }
          }
          Enums: {
            "adjunto_tipo": "factura"|"certificado"|"extracto","ambito": "personal"|"negocio","categoria_clase": "gasto"|"ingreso","categoria_tipo": "fijo"|"variable","comprobante_estado": "procesando"|"registrado"|"soporte"|"por_revisar"|"descartado"|"error","cuenta_tipo": "banco"|"efectivo"|"tarjeta"|"billetera","frecuencia": "semanal"|"quincenal"|"mensual"|"bimestral"|"trimestral"|"semestral"|"anual","meta_tipo": "presupuesto"|"meta","mov_estado": "confirmado"|"programado","mov_origen": "manual"|"importacion"|"recurrente"|"ocr"|"whatsapp"|"banco","mov_tipo": "ingreso"|"gasto"|"transferencia","periodo": "mensual"|"anual"|"unico","permiso_staff": "ver_hogares"|"ver_finanzas"|"usuarios"|"tickets"|"cobros"|"planes"|"parametros"|"campanas"|"equipo"|"exportar"|"sistema"|"auditoria","repeticion": "una_vez"|"mensual"|"anual","rol_miembro": "admin"|"editor"|"contador","rol_staff": "superadmin"|"soporte"|"finanzas"|"contenido"
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
            "adjunto_tipo": ["factura", "certificado", "extracto"],"ambito": ["personal", "negocio"],"categoria_clase": ["gasto", "ingreso"],"categoria_tipo": ["fijo", "variable"],"comprobante_estado": ["procesando", "registrado", "soporte", "por_revisar", "descartado", "error"],"cuenta_tipo": ["banco", "efectivo", "tarjeta", "billetera"],"frecuencia": ["semanal", "quincenal", "mensual", "bimestral", "trimestral", "semestral", "anual"],"meta_tipo": ["presupuesto", "meta"],"mov_estado": ["confirmado", "programado"],"mov_origen": ["manual", "importacion", "recurrente", "ocr", "whatsapp", "banco"],"mov_tipo": ["ingreso", "gasto", "transferencia"],"periodo": ["mensual", "anual", "unico"],"permiso_staff": ["ver_hogares", "ver_finanzas", "usuarios", "tickets", "cobros", "planes", "parametros", "campanas", "equipo", "exportar", "sistema", "auditoria"],"repeticion": ["una_vez", "mensual", "anual"],"rol_miembro": ["admin", "editor", "contador"],"rol_staff": ["superadmin", "soporte", "finanzas", "contenido"]
          }
        }
} as const
